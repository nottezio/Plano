import { describe, expect, it } from 'vitest';

import {
  HOLD_TEXT,
  RSWS_INR_EVERY_DAYS,
  WEEKLY_ADJUST_TABLE,
  weeklyAdjustFor,
  RSWS_START_MG,
  describeSchedule,
  nextInrDate,
  rswsScheduleLine,
  rswsStartLine,
  spreadWeekly,
  weeklyTotal,
} from './warfarinRsws';

const fmt = (date: string) => date;

describe('RSWS warfarin (unofficial)', () => {
  it('starts 1 × 2 mg and checks INR every 3 days', () => {
    expect(RSWS_START_MG).toBe(2);
    expect(RSWS_INR_EVERY_DAYS).toBe(3);
    expect(nextInrDate('2026-10-11')).toBe('2026-10-14');
    expect(rswsStartLine('2026-10-11', fmt)).toBe('- Warfarin 1 × 2 mg/oral (malam); cek INR 3 hari lagi (2026-10-14)');
  });

  it('writes the ward’s own example back exactly', () => {
    const schedule = spreadWeekly(16);
    expect(schedule).toEqual([2, 2, 2, 2, 2, 3, 3]);
    expect(describeSchedule(schedule)).toBe('Senin–Jumat 2 mg, Sabtu–Minggu 3 mg');
    expect(weeklyTotal(schedule)).toBe(16);
  });

  it('spreads other totals evenly, extras on the weekend first', () => {
    expect(spreadWeekly(14)).toEqual([2, 2, 2, 2, 2, 2, 2]);
    expect(describeSchedule(spreadWeekly(14))).toBe('setiap hari 2 mg');
    expect(spreadWeekly(17)).toEqual([2, 2, 2, 2, 3, 3, 3]);
    expect(spreadWeekly(12)).toEqual([1, 1, 2, 2, 2, 2, 2]);
    expect(describeSchedule(spreadWeekly(12))).toBe('Senin–Selasa 1 mg, Rabu–Minggu 2 mg');
    expect(spreadWeekly(15.5, 0.5)).toEqual([2, 2, 2, 2, 2.5, 2.5, 2.5]);
  });

  it('rounds a total to the dose step', () => {
    expect(weeklyTotal(spreadWeekly(16.4))).toBe(16);
    expect(spreadWeekly(0)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(describeSchedule(spreadWeekly(0))).toBe('tunda semua hari');
  });

  it('writes a Terapi line with the weekly total and the next INR', () => {
    expect(rswsScheduleLine([2, 2, 2, 2, 2, 3, 3], 1.6, '2026-10-11', fmt)).toBe(
      '- Warfarin Senin–Jumat 2 mg, Sabtu–Minggu 3 mg/oral (16 mg/minggu) (INR 1,6); cek INR 3 hari lagi (2026-10-14)',
    );
  });
});

describe('weekly adjustment table (Table 15)', () => {
  const pct = (inr: number) => weeklyAdjustFor(inr).map((row) => row.percent);
  it.each([
    [1.2, [15]],
    [1.5, [15]],
    [1.6, [10]],
    [1.9, [10]],
    [2.0, [0]],
    [2.9, [0]],
    [3.0, [-10]],
    [3.9, [-10]],
    [4.0, [-10]],
    [4.9, [-10]],
    [5.0, [-15]],
    [7.2, [-15]],
  ] as const)('INR %s → %j %%/week', (inr, expected) => {
    expect(pct(inr)).toEqual(expected);
  });

  it('holds before restarting at 4–4.9 and ≥5', () => {
    expect(weeklyAdjustFor(4.2)[0]?.hold).toBe('one-dose');
    expect(weeklyAdjustFor(5.5)[0]?.hold).toBe('until-2-3');
  });

  it('an INR in a printed gap returns both neighbours', () => {
    expect(weeklyAdjustFor(1.55).map((row) => row.printed.inr)).toEqual(['≤1.5', '1.6–1.9']);
    expect(weeklyAdjustFor(2.95).map((row) => row.printed.inr)).toEqual(['2–2.9', '3–3.9']);
    expect(weeklyAdjustFor(0)).toEqual([]);
  });

  it('keeps the printed cells verbatim', () => {
    expect(WEEKLY_ADJUST_TABLE.map((row) => row.printed.action)).toEqual([
      '↑ by 15%/week',
      '↑ by 10%/week',
      'Unchanged',
      '↓ by 10%/week',
      'Hold 1 dose, then restart with dose ↓ by 10%/week',
      'Hold until INR is 2–3, then restart with dose ↓ by 15%/week',
    ]);
  });

  it('puts the hold in the Terapi line', () => {
    expect(rswsScheduleLine([2, 2, 2, 2, 2, 2, 2], 4.3, '2026-10-11', fmt, HOLD_TEXT['one-dose'])).toMatch(
      /^- Warfarin tunda 1 dosis, lalu setiap hari 2 mg\/oral/,
    );
  });
});
