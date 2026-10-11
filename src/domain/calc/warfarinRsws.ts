import { addDays } from '../clinicalDate';
import type { ClinicalDate } from '../types';

/**
 * Warfarin, the way the RSWS cardiology ward does it — UNOFFICIAL
 * (2026-10-11).
 *
 * Source: Avi, describing ward practice ("we usually check INR for on
 * warfarin patient per 3 day, and we adjust the already given dose and
 * instruct the resulted adjustment for the week … Senin–Jumat 2 mg, Sabtu
 * Minggu 3 mg. We also start … 1x2 mg"). No written protocol has been seen.
 * So the card takes from it only what it states:
 *   - start 1 × 2 mg;
 *   - INR every 3 days;
 *   - the dose is a WEEKLY total written as a day-by-day schedule.
 * HOW MUCH to change the weekly total for a given INR is not part of what was
 * stated, so the card never suggests it: the doctor sets the new total (or a
 * percentage), and the card only does the arithmetic and writes the schedule.
 */

export const RSWS_START_MG = 2;
export const RSWS_INR_EVERY_DAYS = 3;

/** Monday first, as the ward writes the week. */
export const WEEKDAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as const;

export type WeekSchedule = readonly [number, number, number, number, number, number, number];

export function weeklyTotal(schedule: readonly number[]): number {
  return schedule.reduce((sum, dose) => sum + (Number.isFinite(dose) ? dose : 0), 0);
}

const round = (value: number, step: number): number => Math.round(value / step) * step;
const fix = (value: number): number => Math.round(value * 100) / 100;

/**
 * A weekly total as seven daily doses in `step` mg (1 mg = half a 2 mg
 * tablet). Evenly, with the extra steps on the weekend first and then back
 * through the week — the shape of the ward's example (16 mg: Senin–Jumat 2,
 * Sabtu–Minggu 3). A total that is not a whole number of steps is rounded to
 * the nearest one, and the caller shows the rounded total.
 */
export function spreadWeekly(total: number, step = 1): WeekSchedule {
  const weekly = Math.max(0, round(total, step));
  const base = Math.floor(fix(weekly / 7 / step)) * step;
  let extra = Math.round(fix((weekly - base * 7) / step));
  const days = Array.from({ length: 7 }, () => base);
  // Sunday, Saturday, then Friday back to Monday.
  for (const index of [6, 5, 4, 3, 2, 1, 0]) {
    if (extra <= 0) break;
    days[index] = fix(days[index]! + step);
    extra -= 1;
  }
  return days.map(fix) as unknown as WeekSchedule;
}

const mg = (value: number): string => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value);

/**
 * "Senin–Jumat 2 mg, Sabtu–Minggu 3 mg": runs of consecutive days with the
 * same dose. "Setiap hari 2 mg" when all seven match.
 */
export function describeSchedule(schedule: readonly number[]): string {
  if (schedule.every((dose) => dose === schedule[0])) {
    return schedule[0] === 0 ? 'tunda semua hari' : `setiap hari ${mg(schedule[0]!)} mg`;
  }
  const runs: string[] = [];
  let start = 0;
  for (let index = 1; index <= 7; index += 1) {
    if (index < 7 && schedule[index] === schedule[start]) continue;
    const days = index - 1 === start ? WEEKDAYS[start]! : `${WEEKDAYS[start]}–${WEEKDAYS[index - 1]}`;
    const dose = schedule[start]!;
    runs.push(`${days} ${dose === 0 ? 'tunda' : `${mg(dose)} mg`}`);
    start = index;
  }
  return runs.join(', ');
}

export function nextInrDate(today: ClinicalDate): ClinicalDate {
  return addDays(today, RSWS_INR_EVERY_DAYS);
}

export function rswsStartLine(today: ClinicalDate, formatDate: (date: ClinicalDate) => string): string {
  return `- Warfarin 1 × ${RSWS_START_MG} mg/oral (malam); cek INR ${RSWS_INR_EVERY_DAYS} hari lagi (${formatDate(nextInrDate(today))})`;
}

export function rswsScheduleLine(
  schedule: readonly number[],
  inr: number | null,
  today: ClinicalDate,
  formatDate: (date: ClinicalDate) => string,
): string {
  const inrText = inr !== null && Number.isFinite(inr) ? ` (INR ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(inr)})` : '';
  return (
    `- Warfarin ${describeSchedule(schedule)}/oral (${mg(weeklyTotal(schedule))} mg/minggu)${inrText}; ` +
    `cek INR ${RSWS_INR_EVERY_DAYS} hari lagi (${formatDate(nextInrDate(today))})`
  );
}
