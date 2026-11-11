import { isClinicalDate } from '@/domain/clinicalDate';
import { nameTokens, sameWord } from '@/domain/jaga/match';
import type { ClinicalDate } from '@/domain/types';

/**
 * The date and sending unit printed on a lab report, for the block heading.
 *
 * WHY (2026-10-02): the lab sheet headed every block with the NOTE's day in
 * the rail's short form — `*Laboratorium (30 Agu)*` — while every lab heading
 * written by hand in the corpus is `*Laboratorium PJT (05-09-2026)*`. Worse,
 * the note's day is often not the lab's day: a result read the morning after
 * a 23:30 IGD draw, or a culture registered five days before it resulted, was
 * filed under the wrong date. The report says when the sample was taken; the
 * heading should say the same.
 *
 * Which date: `Tgl. Registrasi` — when the sample was registered, i.e. drawn.
 * That is the date a lab is referred to by on rounds ("lab tanggal 4"). It
 * can be a day earlier than `Tgl. Hasil` (registered 04/09 23:36, resulted
 * 05/09 01:59) or days earlier for a culture. `Tgl. Hasil` is the fallback
 * for a report where registration is missing.
 *
 * Two printouts: `14/09/2026 21:00:55` (lab) and `14/09/26 23.50` (some
 * exports). Both are day-first.
 */

const REGISTRATION = /tgl\.?\s*registrasi\s*:?\s*(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})\b/gi;
const RESULT = /tgl\.?\s*hasil\s*:?\s*(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})\b/gi;
const UNIT = /unit\s+pengantar\s*:\s*(.+?)(?:\s{2,}|\s+(?:no\.|nama|tgl\.|dokter|diagnosa|nama\s+tindakan)\b|$)/im;

export function toDate(day: string, month: string, year: string): ClinicalDate | null {
  const fullYear = year.length === 2 ? `20${year}` : year;
  const value = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  if (!isClinicalDate(value)) return null;
  // Reject 31-02 and friends: isClinicalDate checks the shape only.
  const check = new Date(`${value}T00:00:00Z`);
  return check.getUTCDate() === Number(day) && check.getUTCMonth() + 1 === Number(month) ? value : null;
}

function datesFrom(pattern: RegExp, text: string): ClinicalDate[] {
  const found = new Set<ClinicalDate>();
  for (const match of text.matchAll(pattern)) {
    const date = toDate(match[1] ?? '', match[2] ?? '', match[3] ?? '');
    if (date) found.add(date);
  }
  return [...found];
}

/**
 * The sending unit as a heading word: `PJT Perawatan Lt. 4 (Atrium)` → `PJT`,
 * `IGD Jantung` / `IGD Sentral 2` → `IGD`, anything else as printed (`CVCU`,
 * `HCU PJT`, `Poli Aritmia`).
 */
export function labUnitLabel(unit: string): string {
  const text = unit.trim().replace(/\s+/g, ' ');
  if (/^pjt\s+perawatan\b/i.test(text)) return 'PJT';
  if (/^igd\b/i.test(text)) return 'IGD';
  return text;
}

export interface LabMeta {
  /** Every distinct sample date in the text, oldest first. */
  dates: ClinicalDate[];
  /** The newest of them, or null when the text carries none. */
  date: ClinicalDate | null;
  /** Heading word for the first report's sending unit, or null. */
  unit: string | null;
}

export function readLabMeta(text: string): LabMeta {
  let dates = datesFrom(REGISTRATION, text);
  if (dates.length === 0) dates = datesFrom(RESULT, text);
  dates.sort();
  const unitMatch = UNIT.exec(text);
  const unit = unitMatch?.[1]?.trim() ? labUnitLabel(unitMatch[1]) : null;
  return { dates, date: dates.at(-1) ?? null, unit };
}

/**
 * Patient names printed on the report(s): `Nama : TN. CONTOH Tgl. Registrasi …`.
 * The value ends at a run of spaces or the next header label on the same row.
 */
const NAME =
  /\bnama(?:\s+pasien)?\s*:\s*(.+?)(?=\s{2,}|\s+(?:tgl\.?|tanggal|no\.|sex|jenis|umur|dokter|unit|ruang|alamat)\b|$)/gim;

export function labPatientNames(text: string): string[] {
  const found = new Map<string, string>();
  for (const match of text.matchAll(NAME)) {
    const name = match[1]?.trim();
    if (name) found.set(name.toUpperCase(), name);
  }
  return [...found.values()];
}

/**
 * Could a name on the report be this patient? WHY (2026-11-11): a PDF dropped
 * from the wrong patient's folder formats exactly like the right one, and the
 * numbers give no hint. The two documents never spell a name the same way —
 * titles (`TN.`, `Ny.`), `ABD` for `Abdul`, a missing letter, a dropped
 * surname — so this asks only whether ANY real name-word is shared, allowing
 * one typo or an abbreviation. It flags names that share nothing; it never
 * claims two names are the same person.
 */
export function namesCouldMatch(a: string, b: string): boolean {
  // Old and new Indonesian spellings, and doubled letters: Djamal/Jamal, Soekarno/Sukarno, Sitti/Siti, Marylin/Marilyn.
  const spell = (word: string): string =>
    word.replace(/dj/g, 'j').replace(/tj/g, 'c').replace(/oe/g, 'u').replace(/y/g, 'i').replace(/(.)\1/g, '$1');
  const left = nameTokens(a).map(spell);
  const right = nameTokens(b).map(spell);
  // Nothing to compare (titles only, or only common words like Muhammad): no claim either way.
  if (left.length === 0 || right.length === 0) return true;
  return left.some((l) => right.some((r) => sameWord(l, r) || l.startsWith(r) || r.startsWith(l)));
}

/** Names on the report that share no word with the patient's name. */
export function labNameMismatches(text: string, patientName: string): string[] {
  return labPatientNames(text).filter((name) => !namesCouldMatch(name, patientName));
}

/** Record numbers printed on the report(s): `No. RM : 01234567`. */
const RM = /\bno\.?\s*(?:rm|rekam\s+medi[sk])\s*:?\s*(\d[\d.-]*)/gi;

/** Digits only, without leading zeros: the PDF prints `01761685`, the app holds `1761685`. */
const rmKey = (value: string): string => value.replace(/\D/g, '').replace(/^0+/, '');

export function labRmNumbers(text: string): string[] {
  const found = new Map<string, string>();
  for (const match of text.matchAll(RM)) {
    const printed = match[1]?.replace(/[.-]+$/, '') ?? '';
    if (rmKey(printed)) found.set(rmKey(printed), printed);
  }
  return [...found.values()];
}

export interface LabIdentityCheck {
  /** RM numbers on the report that differ from the patient's. */
  rm: string[];
  /** Names on the report that share no word with the patient's. */
  names: string[];
}

/**
 * Who the report belongs to, against the open patient. The RM is the identifier:
 * when the report prints the patient's own RM, the name is not second-guessed
 * (a mismatching name there is a spelling problem, not a wrong patient). With no
 * RM to go on, on either side, the loose name check is all there is.
 */
export function labIdentityCheck(
  text: string,
  patient: { name?: string | null | undefined; mrn?: string | null | undefined },
): LabIdentityCheck {
  const mine = rmKey(patient.mrn ?? '');
  const printed = labRmNumbers(text);
  const rm = mine ? printed.filter((value) => rmKey(value) !== mine) : [];
  const confirmedByRm = mine !== '' && printed.length > 0 && rm.length === 0;
  const names = !confirmedByRm && patient.name?.trim() ? labNameMismatches(text, patient.name) : [];
  return { rm, names };
}

/** `2026-10-02` → `02-10-2026`, the form lab and EKG headings are written in. */
export function headingDate(date: ClinicalDate): string {
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;
  return `${day}-${month}-${year}`;
}

/** The block title before any report says otherwise (Avi, 2026-10-02). */
export const DEFAULT_LAB_TITLE = 'Laboratorium PJT';

export function labTitleFor(meta: LabMeta): string {
  return meta.unit ? `Laboratorium ${meta.unit}` : DEFAULT_LAB_TITLE;
}
