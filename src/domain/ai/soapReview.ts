import type { SoapFinding, SoapFindingLevel } from '@/domain/format/soapCheck';

/**
 * The AI pass of "Periksa lagi": prompt, output schema, and — the part that
 * matters most — VERIFICATION of what comes back.
 *
 * WHAT CHANGED, AND WHY
 *
 *  - It answered in free text, split on newlines: no urgency, no way to jump
 *    to the place, nothing to check a claim against. Now it answers through a
 *    forced tool with a fixed shape.
 *  - Every finding must carry a verbatim QUOTE from today's note, and a
 *    finding whose quote is not in the note is DROPPED here, before anyone
 *    sees it. A model that "finds" something in text that does not exist is
 *    the failure that makes a checker worthless; this makes that failure
 *    mechanically visible instead of plausible. The quote is also what
 *    "Tampilkan" jumps to.
 *  - It is told what the rules already found and not to repeat it. The rules
 *    are exact and free; the AI's slots are for what rules cannot judge: A
 *    and P not matching, an abnormal value never addressed, sections that
 *    contradict each other.
 *
 * What it must never do is unchanged: no clinical advice, no dose, no new
 * diagnosis. It points at inconsistencies and omissions in what is written.
 */

export const SOAP_REVIEW_TOOL = {
  name: 'laporkan_temuan',
  description: 'Laporkan temuan pemeriksaan catatan SOAP. Kosongkan daftar bila tidak ada.',
  input_schema: {
    type: 'object',
    properties: {
      temuan: {
        type: 'array',
        maxItems: 6,
        items: {
          type: 'object',
          properties: {
            kategori: {
              type: 'string',
              enum: ['isi', 'kemarin', 'cek'],
              description:
                'isi = ada yang belum ditulis; kemarin = tersalin dari kemarin dan belum diperbarui; cek = dua bagian catatan tidak cocok',
            },
            pesan: {
              type: 'string',
              description: 'Satu kalimat pendek bahasa Indonesia: apa yang perlu dilihat. Tanpa saran terapi.',
            },
            kutipan: {
              type: 'string',
              description:
                'Potongan teks PERSIS dari CATATAN HARI INI (disalin huruf demi huruf, 3–80 karakter) di tempat masalahnya.',
            },
          },
          required: ['kategori', 'pesan', 'kutipan'],
        },
      },
    },
    required: ['temuan'],
  },
} as const;

export function soapReviewSystem(options: {
  today: string;
  previousDate: string | null;
  ruleFindings: readonly Pick<SoapFinding, 'message'>[];
}): string {
  return [
    'Kamu memeriksa catatan SOAP kardiologi berbahasa Indonesia sebelum dikirim ke konsulen.',
    'Tugasmu MENUNJUK ketidakcocokan dan kelalaian di dalam catatan — bukan menilai tatalaksana.',
    '',
    `Tanggal catatan hari ini: ${options.today}.`,
    options.previousDate ? `Tanggal catatan sebelumnya: ${options.previousDate}.` : 'Tidak ada catatan sebelumnya.',
    '',
    'SUDAH DITEMUKAN OLEH PEMERIKSA OTOMATIS — JANGAN diulang, dalam bentuk apa pun:',
    ...(options.ruleFindings.length > 0
      ? options.ruleFindings.map((finding) => `- ${finding.message}`)
      : ['- (tidak ada)']),
    '',
    'YANG DIPERIKSA (hal yang tidak bisa dinilai pemeriksa otomatis):',
    '1. Masalah di A yang tidak punya rencana/terapi di P, atau terapi/rencana di P tanpa masalah di A.',
    '2. Nilai abnormal di O atau lab (hasil yang tertulis) yang tidak disinggung di A atau P.',
    '3. Bagian yang saling bertentangan: S vs A, obat yang sama dengan dosis berbeda,',
    '   obat yang disebut dihentikan tapi masih tertulis di terapi, sisi kiri/kanan yang tidak konsisten.',
    '4. Angka yang berbeda antar bagian untuk hal yang sama (mis. EF di echo vs di diagnosis).',
    '5. Identitas yang tidak konsisten di dalam catatan (umur, jenis kelamin, nama).',
    '6. Tanggal di catatan yang lebih baru dari tanggal hari ini.',
    '7. Hal harian yang tersalin dari kemarin dan belum diperbarui, bila BELUM ada di daftar di atas',
    '   (keluhan, terapi yang sudah berubah, rencana yang sudah dikerjakan).',
    '',
    'CARA MEMERIKSA — wajib:',
    '- Untuk setiap hal yang mau dilaporkan, CARI DULU di CATATAN HARI INI. Kalau sudah ada, jangan dilaporkan.',
    '- Kalau ragu, JANGAN dilaporkan. Lebih baik tidak ada temuan daripada temuan salah.',
    '- "kutipan" wajib disalin PERSIS dari CATATAN HARI INI. Temuan yang kutipannya tidak ada di catatan akan dibuang.',
    '',
    'ARTI PENANDA HARI:',
    '- H-2 berarti HARI KE-2, bukan 2 hari sebelum sesuatu. Besoknya H-3.',
    '- Kecuali di konteks rencana pulang, di mana H-1 berarti besok pulang.',
    '',
    'YANG BUKAN KESALAHAN — jangan sebutkan:',
    '- Echo, foto thorax, MSCT, atau EKG lama yang sama dengan kemarin (tidak diulang).',
    '- Diagnosis, riwayat, dan faktor risiko yang memang tetap.',
    '- Gaya penulisan, singkatan, ejaan.',
    '',
    'ATURAN KERAS:',
    '- JANGAN memberi saran klinis, dosis, obat, pemeriksaan tambahan, atau diagnosis baru.',
    '- JANGAN mengarang temuan.',
    '- Maksimal 6 temuan, yang paling penting dulu. Jika tidak ada, kirim daftar kosong.',
  ].join('\n');
}

export function soapReviewPrompt(today: string, previous: string | undefined): string {
  return [previous ? `CATATAN KEMARIN:\n${previous}\n\n` : '', `CATATAN HARI INI:\n${today}`].join('');
}

export interface AiFinding {
  level: SoapFindingLevel;
  message: string;
  anchor: string;
  at: number;
}

export interface SoapReviewResult {
  findings: AiFinding[];
  /** Findings dropped because their quote is not in the note. */
  dropped: number;
}

/** Where a quote sits in the note, tolerant of whitespace and case only. */
export function locateQuote(body: string, quote: string): { at: number; text: string } | null {
  const words = quote
    .trim()
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (words.length === 0) return null;
  const match = new RegExp(words.join('\\s+'), 'i').exec(body);
  return match ? { at: match.index, text: match[0] } : null;
}

const LEVELS = new Set<SoapFindingLevel>(['isi', 'kemarin', 'cek']);
const ORDER: Record<SoapFindingLevel, number> = { isi: 0, kemarin: 1, cek: 2 };

/**
 * Validate the tool input and keep only what can be verified against the note.
 * Anything malformed is dropped, not guessed at.
 */
export function parseSoapReview(input: unknown, body: string): SoapReviewResult {
  const list = (input as { temuan?: unknown } | null)?.temuan;
  if (!Array.isArray(list)) return { findings: [], dropped: 0 };

  const findings: AiFinding[] = [];
  let dropped = 0;
  const seen = new Set<string>();
  for (const item of list.slice(0, 6)) {
    const entry = item as { kategori?: unknown; pesan?: unknown; kutipan?: unknown };
    const level = typeof entry.kategori === 'string' && LEVELS.has(entry.kategori as SoapFindingLevel)
      ? (entry.kategori as SoapFindingLevel)
      : 'cek';
    const message = typeof entry.pesan === 'string' ? entry.pesan.trim() : '';
    const quote = typeof entry.kutipan === 'string' ? entry.kutipan : '';
    if (!message) {
      dropped += 1;
      continue;
    }
    const located = quote.trim().length >= 3 ? locateQuote(body, quote) : null;
    if (!located) {
      dropped += 1;
      continue;
    }
    const key = message.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({ level, message, anchor: located.text, at: located.at });
  }
  findings.sort((a, b) => ORDER[a.level] - ORDER[b.level]);
  return { findings, dropped };
}
