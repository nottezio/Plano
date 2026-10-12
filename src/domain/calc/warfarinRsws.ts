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

/** How a weekly total that is not a whole number of steps is rounded (12.12: chosen by the doctor). */
export type RoundMode = 'nearest' | 'down' | 'up';

const round = (value: number, step: number, mode: RoundMode = 'nearest'): number => {
  // fix() first, so 17.6000000001 / 0.5 is not pushed up a step by float noise.
  const steps = Math.round((value / step) * 1e6) / 1e6;
  return (mode === 'down' ? Math.floor(steps) : mode === 'up' ? Math.ceil(steps) : Math.round(steps)) * step;
};

/** The weekly total `spreadWeekly` would write, for each rounding. */
export function roundedTotals(total: number, step = 1): Record<RoundMode, number> {
  return {
    nearest: fix(Math.max(0, round(total, step, 'nearest'))),
    down: fix(Math.max(0, round(total, step, 'down'))),
    up: fix(Math.max(0, round(total, step, 'up'))),
  };
}
const fix = (value: number): number => Math.round(value * 100) / 100;

/**
 * A weekly total as seven daily doses in `step` mg (1 mg = half a 2 mg
 * tablet). Evenly, with the extra steps on the weekend first and then back
 * through the week — the shape of the ward's example (16 mg: Senin–Jumat 2,
 * Sabtu–Minggu 3). A total that is not a whole number of steps is rounded to
 * the nearest one — or down / up when the doctor chooses (12.12) — and the
 * caller shows the rounded total.
 */
export function spreadWeekly(total: number, step = 1, mode: RoundMode = 'nearest'): WeekSchedule {
  const weekly = Math.max(0, round(total, step, mode));
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
  /** "tunda 1 dosis, lalu " when the table says to hold first. */
  holdPrefix = '',
): string {
  const inrText = inr !== null && Number.isFinite(inr) ? ` (INR ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(inr)})` : '';
  return (
    `- Warfarin ${holdPrefix}${describeSchedule(schedule)}/oral (${mg(weeklyTotal(schedule))} mg/minggu)${inrText}; ` +
    `cek INR ${RSWS_INR_EVERY_DAYS} hari lagi (${formatDate(nextInrDate(today))})`
  );
}

/**
 * The weekly adjustment table the ward uses (Avi, 11-10-2026: "We use this
 * protocol"), copied from the photo he sent:
 *
 *   Table 15 "Maintenance warfarin dosing for out-of-therapeutic-range
 *   international normalized ratio" — "Suggested dose adjustment in case of
 *   out-of-therapeutic-range INR (ref 556). Importantly, dosing is optimized
 *   not using daily dose adjustments but adjustments based on the weekly
 *   intake in warfarin."
 *
 * Its "Unchanged" row is 2–2.9, so it is a table for a 2.0–3.0 target and is
 * offered only there. The bands are printed to one decimal and leave gaps
 * (1.5–1.6, 1.9–2.0 …); an INR in a gap gets BOTH neighbouring rows and no
 * pre-selected change, rather than a rounded guess.
 */
export interface WeeklyAdjustRow {
  low: number | null;
  high: number | null;
  /** Weekly change, percent. */
  percent: number;
  hold: 'none' | 'one-dose' | 'until-2-3';
  printed: { inr: string; action: string };
}

export const WEEKLY_ADJUST_TABLE: readonly WeeklyAdjustRow[] = [
  { low: null, high: 1.5, percent: 15, hold: 'none', printed: { inr: '≤1.5', action: '↑ by 15%/week' } },
  { low: 1.6, high: 1.9, percent: 10, hold: 'none', printed: { inr: '1.6–1.9', action: '↑ by 10%/week' } },
  { low: 2, high: 2.9, percent: 0, hold: 'none', printed: { inr: '2–2.9', action: 'Unchanged' } },
  { low: 3, high: 3.9, percent: -10, hold: 'none', printed: { inr: '3–3.9', action: '↓ by 10%/week' } },
  {
    low: 4,
    high: 4.9,
    percent: -10,
    hold: 'one-dose',
    printed: { inr: '4–4.9', action: 'Hold 1 dose, then restart with dose ↓ by 10%/week' },
  },
  {
    low: 5,
    high: null,
    percent: -15,
    hold: 'until-2-3',
    printed: { inr: '≥5', action: 'Hold until INR is 2–3, then restart with dose ↓ by 15%/week' },
  },
];

/** The row(s) for an INR: one, or the two neighbours when it falls in a printed gap. */
export function weeklyAdjustFor(inr: number): WeeklyAdjustRow[] {
  if (!(Number.isFinite(inr) && inr > 0)) return [];
  const inside = WEEKLY_ADJUST_TABLE.filter(
    (row) => (row.low === null || inr >= row.low) && (row.high === null || inr <= row.high),
  );
  if (inside.length > 0) return inside;
  const below = [...WEEKLY_ADJUST_TABLE].reverse().find((row) => row.high !== null && inr > row.high);
  const above = WEEKLY_ADJUST_TABLE.find((row) => row.low !== null && inr < row.low);
  return [below, above].filter((row): row is WeeklyAdjustRow => row !== undefined);
}

export const HOLD_TEXT: Record<WeeklyAdjustRow['hold'], string> = {
  none: '',
  'one-dose': 'tunda 1 dosis, lalu ',
  'until-2-3': 'tunda sampai INR 2–3, lalu ',
};
