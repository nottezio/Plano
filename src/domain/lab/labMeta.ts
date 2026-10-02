import { isClinicalDate } from '@/domain/clinicalDate';
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

function toDate(day: string, month: string, year: string): ClinicalDate | null {
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
