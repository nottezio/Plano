import type { ClinicalDate } from '../types';

/**
 * `04-09-2026` — all numeric, zero padded.
 *
 * Not `formatShortDateNoWeekday`, which writes `4 Sep`. This string goes into
 * the note as part of a heading the DPJP reads, and every dated heading in the
 * corpus uses the numeric form.
 *
 * Built by splitting the id rather than through a Date, because the id is
 * already `YYYY-MM-DD` and round-tripping it through a Date only introduces
 * the timezone question this app spent a release getting rid of.
 */
function numericDate(date: ClinicalDate): string {
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;
  return `${day}-${month}-${year}`;
}

/**
 * Blocks of boilerplate a resident retypes every admission.
 *
 * These replaced the "Sisipkan bagian" dropdown, which inserted a bare `*O:*`
 * heading. That saved five characters of a heading anyone can type, on a
 * screen where the actual work is the paragraph underneath it — Avicenna's
 * word for it was redundant, and it was.
 *
 * Every snippet keeps its blanks as `...`. A template that guesses at a value
 * is worse than one that leaves a hole: a hole is visible in the note and in
 * the message that goes to the chief, and an invented number is not.
 */
export interface Snippet {
  id: string;
  label: string;
  /** `date` is the clinical day of the note being edited. */
  build: (date: ClinicalDate) => string;
}

export const SNIPPETS: readonly Snippet[] = [
  {
    id: 'ekg',
    label: 'EKG hari ini',
    /**
     * The heading only, dated, with the reading left blank.
     *
     * The date is the note's clinical day rather than today's wall clock: a
     * note written after midnight for the previous day must carry that day's
     * date, which is the same rule the rest of the app follows.
     */
    /**
     * The floor is left BLANK on purpose.
     *
     * A patient moves between Lantai 4, Lantai 5, CVCU and IGD during one
     * stay, and the app knows the ward on the patient record but not which
     * floor the tracing was actually taken on — those differ the day someone
     * is moved. Prefilling it would be right most days and quietly wrong on
     * exactly the day it matters.
     */
    build: (date) => `*EKG di PJT Lt. ... (${numericDate(date)})*\n`,
  },
  {
    id: 'keluhan-pendek',
    label: 'Keluhan pendek',
    build: () =>
      [
        '- Sekarang nyeri dada tidak ada, berdebar tidak ada, sesak nafas tidak ada.',
        '- Keluhan lain demam tidak ada, batuk beringus tidak ada, mual dan muntah tidak ada.',
        '- BAB dan BAK kesan normal.',
        '',
      ].join('\n'),
  },
  {
    id: 'anamnesis',
    label: 'Anamnesis panjang',
    build: () =>
      [
        '- Pasien masuk dengan keluhan nyeri dada kiri yang sudah dialami sejak ..., dengan NRS (...). Keluhan nyeri dada kiri tembus belakang dan terasa menjalar ke lengan kiri, dengan durasi .... Keluhan disertai keringat dingin, mual dan muntah tidak ada. Riwayat nyeri dada sebelumnya ada namun dirasakan hilang timbul. Keluhan sesak nafas tidak ada, riwayat sesak nafas tidak ada. DOE (-), PND (-), orthopneu (-). Pasien dapat berbaring terlentang. Keluhan dan riwayat berdebar sebelumnya tidak ada.',
        '- Keluhan lain berupa : Demam tidak ada, batuk tidak ada, rasa mual dan muntah tidak ada, BAK dan BAB kesan normal.',
        '- Pasien rujukan dari RS ... dan telah mendapat terapi : ',
        '',
      ].join('\n'),
  },
  {
    id: 'pemeriksaan-fisik',
    label: 'Pemeriksaan fisik + TTV',
    /**
     * Vital signs blank, examination findings prefilled.
     *
     * The split is deliberate. Every number here is measured on this patient
     * this morning, and a prefilled `120/80` that nobody replaced is a
     * fabricated observation in a clinical record — the one class of error
     * this app must not make convenient.
     *
     * The examination lines are different: they are the NORMAL findings,
     * written the way the corpus writes them, and the work is editing the few
     * that are abnormal. Leaving those blank too would mean retyping six
     * unchanged lines to record one changed one.
     */
    build: () =>
      [
        'Compos Mentis GCS (E4V5M6)',
        'Tekanan Darah : ... mmHg',
        'Nadi : ... kali/menit, reguler',
        'Pernapasan : ... kali/menit',
        'Suhu : ... derajat Celcius',
        'SpO2 : ... % on room air',
        '',
        'Anemis tidak ada, ikterus tidak ada',
        'JVP R+2 cmH20',
        'BJ I/II murni reguler, murmur tidak terdengar',
        'BP Vesikuler, ronkhi dan wheezing tidak ada',
        'Abdomen peristaltik kesan normal',
        'Edema ekstremitas tidak ada, akral hangat, CTR < 2 detik',
        '',
      ].join('\n'),
  },
  {
    id: 'faktor-risiko',
    label: 'Faktor risiko kardiovaskular',
    build: () =>
      [
        'Faktor Risiko Kardiovaskular :',
        '- Riwayat hipertensi ...',
        '- Riwayat diabetes melitus ...',
        '- Riwayat merokok ...',
        '- Riwayat penyakit jantung di keluarga tidak ada',
        '',
      ].join('\n'),
  },
];

/**
 * Insert a snippet at the caret.
 *
 * A newline is added BEFORE the block when the caret is mid-line, so a snippet
 * dropped at the end of an existing sentence starts on its own line instead of
 * running into it. Nothing is added when the line is already empty, which is
 * where these are normally inserted.
 */
export function insertSnippet(
  text: string,
  caret: number,
  snippet: string,
): { text: string; selectionStart: number; selectionEnd: number } {
  const before = text.slice(0, caret);
  const needsBreak = before.length > 0 && !before.endsWith('\n');
  const block = `${needsBreak ? '\n' : ''}${snippet}`;
  const next = `${before}${block}${text.slice(caret)}`;
  const at = caret + block.length;
  return { text: next, selectionStart: at, selectionEnd: at };
}
