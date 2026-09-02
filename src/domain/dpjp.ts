/**
 * The DPJP registry.
 *
 * Every handover already names its consultants on the `_DPJP …_` lines, so this
 * reads what is there rather than asking for it again. Detection drives two
 * things: the initials shown on a board card, and the reminder of which report
 * format that consultant expects.
 *
 * MATCHING IS BY DISTINCTIVE TOKEN, NEVER BY FULL STRING. Titles are written a
 * dozen ways — `Dr. dr. Abdul Hakim Alkatiri, Sp.JP(K)`, `Dr. dr. Abdul Hakim
 * Alkatiri, SpJP(K)`, `dr. A. H. Alkatiri` — and any scheme that depends on
 * punctuation or degree suffixes matching exactly will fail on the first
 * variant someone types at 2am.
 *
 * Ambiguous tokens are deliberately absent. `Tandean` belongs to two
 * consultants and `Muzakkir` to two more, so neither is a key: a wrong
 * attribution is worse than none, because a card labelled with the wrong
 * consultant is a card someone will act on.
 */

import type { DpjpReportConfig, OutputFormat, ReportFormat } from './types';

export type { ReportFormat };

export interface Dpjp {
  id: string;
  /** As written on the DPJP line. */
  name: string;
  /** Short label for the board card. */
  initials: string;
  /**
   * Lowercase tokens unique to this person. Matched against the normalised
   * line, so `alkatiri` catches every spelling of the honorifics around it.
   */
  match: readonly string[];
}

export const DPJPS: readonly Dpjp[] = [
  { id: 'pk', name: 'Prof. dr. Peter Kabo, Ph.D, Sp.FK, Sp.JP(K)', initials: 'PK', match: ['peter kabo', 'kabo'] },
  { id: 'mz', name: 'Prof. Dr. dr. Muzakkir Amir, Sp.JP(K)', initials: 'MZ', match: ['muzakkir amir'] },
  { id: 'im', name: 'Prof. Dr. dr. Idar Mappangara, Sp.PD, Sp.JP(K)', initials: 'IM', match: ['idar mappangara', 'mappangara'] },
  { id: 'aha', name: 'Dr. dr. Abdul Hakim Alkatiri, Sp.JP(K)', initials: 'AHA', match: ['alkatiri'] },
  { id: 'zd', name: 'dr. Zaenab Djafar, M.Kes, Sp.PD, Sp.JP, Subsp.PRKV(K)', initials: 'ZD', match: ['zaenab djafar', 'zaenab'] },
  { id: 'afm', name: 'Dr. dr. Akhtar Fajar Muzakkir, SpJP, Subsp. IKKV(K), KI(K)', initials: 'AFM', match: ['akhtar fajar', 'akhtar'] },
  { id: 'ahn', name: 'Dr. dr. Az Hafid Nashar, Sp.JP(K)', initials: 'AHN', match: ['az hafid', 'hafid nashar', 'nashar'] },
  { id: 'afg', name: 'dr. Aussie Fitriani Ghaznawie, Sp.JP, Subsp.Eko (K)', initials: 'AFG', match: ['ghaznawie', 'aussie'] },
  { id: 'pt', name: 'dr. Pendrik Tandean, Sp.PD-KKV', initials: 'PT', match: ['pendrik'] },
  { id: 'ks', name: 'Dr. dr. Khalid Saleh, Sp.PD-KKV', initials: 'KS', match: ['khalid saleh', 'khalid'] },
  { id: 'sm', name: 'Dr. dr. Sumarni, Sp.JP, Subsp.Ar (K)', initials: 'SM', match: ['sumarni'] },
  { id: 'maa', name: 'dr. Muhammad Asrul Apris, Sp.JP(K)', initials: 'MAA', match: ['asrul apris', 'apris'] },
  { id: 'yp', name: 'Dr. dr. Yulius Patimang, Sp.A, Sp.JP(K)', initials: 'YP', match: ['patimang'] },
  { id: 'aau', name: 'dr. Andi Alief Utama Armyn, M.Kes, Sp.JP, Subsp. KPPJB (K)', initials: 'AAU', match: ['alief utama', 'armyn'] },
  { id: 'fm', name: 'dr. Fadillah Maricar, Sp.JP (K), FIHA', initials: 'FM', match: ['maricar'] },
  { id: 'alm', name: 'dr. Almudai, Sp.PD, Sp.JP(K)', initials: 'ALM', match: ['almudai'] },
  { id: 'is', name: 'dr. Irmarisyani Sudirman, Sp.JP(K)', initials: 'IS', match: ['irmarisyani'] },
  { id: 'aa', name: 'dr. Amelia Arindanie, Sp.JP', initials: 'AA', match: ['arindanie', 'amelia'] },
  { id: 'bpp', name: 'dr. Bogie Putra Palinggi, Sp.JP (K)', initials: 'BPP', match: ['palinggi', 'bogie'] },
  { id: 'fat', name: 'dr. Frizt Alfred Tandean, Sp.JP(K)', initials: 'FAT', match: ['frizt'] },
  { id: 'arb', name: 'dr. Andi Renata Bastario, Sp.JP(K)', initials: 'ARB', match: ['bastario', 'renata'] },
  { id: 'np', name: 'dr. Nurminsyah P., Sp.JP', initials: 'NP', match: ['nurminsyah'] },
  { id: 'mnm', name: 'dr. Muhammad Nuralim Mallapasi, Sp.B, Sp.BTKV(K)VE', initials: 'MNM', match: ['mallapasi', 'nuralim'] },
  { id: 'jk', name: 'dr. Jayarasti Kusumanegara, Sp.BTKV(K)VE', initials: 'JK', match: ['kusumanegara', 'jayarasti'] },
];

const BY_ID = new Map(DPJPS.map((dpjp) => [dpjp.id, dpjp]));

export function dpjpById(id: string): Dpjp | undefined {
  return BY_ID.get(id);
}

/** Longest token first, so `muzakkir amir` is tried before any shorter key. */
const TOKENS: ReadonlyArray<readonly [string, string]> = DPJPS.flatMap((dpjp) =>
  dpjp.match.map((token) => [token, dpjp.id] as const),
).sort((a, b) => b[0].length - a[0].length);

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface DetectedDpjp {
  id: string;
  /** `Utama`, `Tindakan`, `Interna GH` … as written, or null if unlabelled. */
  role: string | null;
}

/**
 * Reads the DPJP lines out of a note.
 *
 * Only lines mentioning DPJP are considered. Scanning the whole body would
 * match a consultant named in a consult reply or a procedure report and
 * attribute the patient to them, which is precisely the wrong answer.
 */
export function detectDpjps(body: string): DetectedDpjp[] {
  const found: DetectedDpjp[] = [];
  const seen = new Set<string>();

  for (const line of body.split('\n')) {
    const flat = normalise(line);
    if (!flat.includes('dpjp')) continue;

    const roleMatch = /dpjp\s+([a-z\s]*?)\s*:/i.exec(line.replace(/[*_]/g, ''));
    const role = roleMatch?.[1]?.trim() || null;

    for (const [token, id] of TOKENS) {
      if (!flat.includes(token) || seen.has(id)) continue;
      seen.add(id);
      found.push({ id, role: role && role.length > 0 ? role : null });
      break;
    }
  }

  return found;
}

/** The consultant a patient is filed under: the first DPJP line in the note. */
export function primaryDpjp(body: string): Dpjp | null {
  const detected = detectDpjps(body);
  const utama = detected.find((entry) => /utama/i.test(entry.role ?? ''));
  const id = (utama ?? detected[0])?.id;
  return id ? (dpjpById(id) ?? null) : null;
}

/** One line describing a consultant's preferences, for the reminder. */
export function describeConfig(config: DpjpReportConfig): string {
  const extras: string[] = [];
  if (config.format === 'ringkas' && config.staffing === false) extras.push('tanpa Chief/Junior');
  if (config.verificationTime) extras.push('dengan jam verifikasi');
  if (config.plainText) extras.push('tanpa tebal/miring');
  if (config.hint) extras.push(config.hint);

  const base = REPORT_FORMAT_LABELS[config.format];
  return extras.length > 0 ? `${base} — ${extras.join(', ')}` : base;
}

export const REPORT_FORMAT_LABELS: Record<ReportFormat, string> = {
  harian: 'Laporan harian',
  diagnosis: 'Diagnosis primer/sekunder',
  ringkas: 'Ringkas (PDF)',
};

/** The copy format a report format implies. */
export const REPORT_OUTPUT: Record<ReportFormat, OutputFormat> = {
  harian: 'whatsapp',
  diagnosis: 'whatsapp',
  ringkas: 'whatsapp',
};

/**
 * The "trio" — the three consultants whose patients get a 6MWT.
 *
 * Ids, not initials or names. Initials are display text and names are written
 * a dozen ways; the id is what `DPJPS` keys on and what
 * `settings.dpjpFormats` already uses, so this list cannot fall out of step
 * with either.
 *
 * A constant rather than a `trio: true` flag on the registry entries: this is
 * a rule about a WARD PRACTICE, not a property of the person. If the practice
 * changes, or a fourth consultant adopts it, this is the one line to edit and
 * it is obvious from here who is on the list.
 */
export const TRIO_DPJP_IDS: readonly string[] = ['afm', 'afg', 'zd'];

export function isTrioDpjp(dpjpId: string | null | undefined): boolean {
  return dpjpId !== null && dpjpId !== undefined && TRIO_DPJP_IDS.includes(dpjpId);
}
