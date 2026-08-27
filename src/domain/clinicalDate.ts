import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';

import type { ClinicalDate } from './types';

/**
 * SPEC 9.1 — the clinical day.
 *
 * Two rules govern this whole file:
 *
 *  1. A ClinicalDate is a "YYYY-MM-DD" *string*, never a Date. The moment a
 *     clinical day is represented as an instant, it acquires a timezone and a
 *     DST offset it does not have. Doc ids are these strings (SPEC 6.3), so
 *     any drift here is a drift in which document a note lands in.
 *
 *  2. All date arithmetic runs in UTC. Parsing "2026-08-06" as *local*
 *     midnight and adding a day is wrong in any zone with DST: the result can
 *     be 23:00 the same day. Every helper below therefore parses to a UTC
 *     instant and formats back from UTC.
 *
 * The timezone only enters in one place — deciding *which* calendar date "now"
 * falls on — which is exactly where it belongs.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

export function isClinicalDate(value: string): value is ClinicalDate {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = toUtcInstant(value);
  return !Number.isNaN(parsed.getTime()) && toDateString(parsed) === value;
}

/** "2026-08-06" → the UTC instant at midnight of that day. */
export function toUtcInstant(date: ClinicalDate): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** A UTC instant → "YYYY-MM-DD". */
export function toDateString(instant: Date): ClinicalDate {
  // Guard the throw at its source too, so no future caller can crash a page by
  // handing this an unparseable date.
  if (Number.isNaN(instant.getTime())) {
    console.warn('[clinicalDate] invalid instant');
    return '' as ClinicalDate;
  }
  return instant.toISOString().slice(0, 10);
}

/**
 * The clinical date for an instant.
 *
 * = calendar date in `tz`, minus one day when the local hour is below
 * `rolloverHour`. With the shipped default of 0 the subtraction never fires,
 * but the parameter is real: a 06:00 rollover is one settings change away and
 * nothing downstream may assume midnight (SPEC 9.1).
 */
export function clinicalDate(now: Date, tz: string, rolloverHour: number): ClinicalDate {
  const zoned = toZonedTime(now, tz);
  const calendarDate = format(zoned, 'yyyy-MM-dd');
  return zoned.getHours() < rolloverHour ? addDays(calendarDate, -1) : calendarDate;
}

/** The local wall-clock hour in `tz` — used by the night-shift hint. */
export function localHour(now: Date, tz: string): number {
  return toZonedTime(now, tz).getHours();
}

export function addDays(date: ClinicalDate, days: number): ClinicalDate {
  // `IGD_ENTRY` is an entry id, not a date. Arithmetic on it produced an
  // Invalid Date, and `toISOString()` on that THROWS — which is what took the
  // whole page down when the admission note was opened.
  //
  // Returning it unchanged is right rather than merely safe: the admission note
  // has no previous day and no next day, so "a day away from it" is itself.
  if (!isDateLike(date)) return date;
  return toDateString(new Date(toUtcInstant(date).getTime() + days * MS_PER_DAY));
}

/** A real `YYYY-MM-DD`, as opposed to an entry id like `igd`. */
export function isDateLike(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function previousDay(date: ClinicalDate): ClinicalDate {
  return addDays(date, -1);
}

export function nextDay(date: ClinicalDate): ClinicalDate {
  return addDays(date, 1);
}

/** Whole days between two clinical dates; correct across months and years. */
export function daysBetween(from: ClinicalDate, to: ClinicalDate): number {
  // NaN would propagate into hari rawat and every rail label built from it.
  if (!isDateLike(from) || !isDateLike(to)) return 0;
  return Math.round((toUtcInstant(to).getTime() - toUtcInstant(from).getTime()) / MS_PER_DAY);
}

/**
 * `hari rawat` — day of admission is day 1, not day 0. A resident saying
 * "hari rawat ke-4" means the fourth calendar day of the stay.
 */
export function hariRawat(date: ClinicalDate, admittedAt: ClinicalDate): number {
  return daysBetween(admittedAt, date) + 1;
}

/** "Kamis, 6 Agustus 2026" — formatted from UTC so the machine tz cannot shift it. */
export function formatLongDate(date: ClinicalDate): string {
  return format(shiftUtcToLocalFields(date), 'EEEE, d MMMM yyyy', { locale: localeId });
}

/** "6 Agu" — compact form for the date rail. */
export function formatShortDate(date: ClinicalDate): string {
  // `date-fns` throws on an invalid date, and every caller here is a label —
  // a page that cannot render a date should still render the page.
  if (!isDateLike(date)) return date === IGD_ENTRY ? 'Awal' : date;
  return format(shiftUtcToLocalFields(date), 'd MMM', { locale: localeId });
}

/** "Kamis, 6 Agustus 2026 · Hari rawat ke-4" — the patient page header (SPEC 9.1). */
/**
 * The admission note, kept outside the day sequence.
 *
 * It is written in the emergency department before the ward stay begins, so it
 * has no hari rawat and belongs before every dated entry. Modelling it as a
 * date would mean inventing one — and any date invented for it is wrong the
 * moment someone reads it as the day something happened.
 *
 * It is stored as an entry id like any other, so it inherits the merge, the
 * revision trail and the copy machinery unchanged. Only the places that do
 * arithmetic on dates need to know it is special.
 */
export const IGD_ENTRY = 'igd' as ClinicalDate;

export function isIgdEntry(date: ClinicalDate): boolean {
  return date === IGD_ENTRY;
}

export function formatDayHeader(date: ClinicalDate, admittedAt: ClinicalDate): string {
  // No date and no hari rawat: it is the note from before the stay.
  if (date === IGD_ENTRY) return 'SOAP Awal · sebelum masuk bangsal';
  return `${formatLongDate(date)} · Hari rawat ke-${hariRawat(date, admittedAt)}`;
}

export function relativeDayLabel(date: ClinicalDate, today: ClinicalDate): string {
  const delta = daysBetween(today, date);
  if (delta === 0) return 'Hari ini';
  if (delta === -1) return 'Kemarin';
  if (delta === 1) return 'Besok';
  return formatShortDate(date);
}

/**
 * date-fns formats using the host's local fields. Building a Date whose *local*
 * fields equal the intended calendar date makes the output deterministic on any
 * machine, which is what the tests assert.
 */
function shiftUtcToLocalFields(date: ClinicalDate): Date {
  const utc = toUtcInstant(date);
  return new Date(utc.getTime() + utc.getTimezoneOffset() * 60_000);
}

export interface YesterdayHintInput {
  now: Date;
  tz: string;
  rolloverHour: number;
  /** The date the user currently has open. */
  selectedDate: ClinicalDate;
  /** Whether an entry exists for the day before the current clinical day. */
  hasYesterdayEntry: boolean;
}

export interface YesterdayHint {
  yesterday: ClinicalDate;
  today: ClinicalDate;
  message: string;
}

/**
 * SPEC 9.1 — the night-shift affordance.
 *
 * Because the day flips at midnight, a resident writing at 01:30 lands on a
 * new date and may not notice. This returns a *hint*; the caller renders a
 * dismissible line with a one-tap switch. It must never redirect on its own —
 * silently moving someone's cursor to another day is worse than the confusion
 * it would prevent.
 */
export function yesterdayHint(input: YesterdayHintInput): YesterdayHint | null {
  const { now, tz, rolloverHour, selectedDate, hasYesterdayEntry } = input;
  if (!hasYesterdayEntry) return null;

  const today = clinicalDate(now, tz, rolloverHour);
  if (selectedDate !== today) return null;

  const hour = localHour(now, tz);
  if (hour < 0 || hour >= 6) return null;

  const yesterday = previousDay(today);
  const todayDayOfMonth = Number(today.slice(8, 10));

  return {
    yesterday,
    today,
    message: `Sekarang sudah tanggal ${todayDayOfMonth}. Menulis untuk ${formatDayNoWeekday(yesterday)}?`,
  };
}

/** "6 Agustus" — used inside the hint sentence. */
export function formatDayNoWeekday(date: ClinicalDate): string {
  return format(shiftUtcToLocalFields(date), 'd MMMM', { locale: localeId });
}

/**
 * SPEC F4 — past entries auto-lock after 48 h.
 *
 * Takes an explicit `now` rather than reading the clock so the caller can pass
 * a server-derived time, and so this stays testable.
 */
export const AUTO_LOCK_HOURS = 48;

export function shouldAutoLock(
  entryDate: ClinicalDate,
  now: Date,
  tz: string,
  rolloverHour: number,
): boolean {
  const today = clinicalDate(now, tz, rolloverHour);
  return daysBetween(entryDate, today) * 24 >= AUTO_LOCK_HOURS;
}

