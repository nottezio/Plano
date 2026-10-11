import { describe, expect, it } from 'vitest';

import {
  RSWS_INR_EVERY_DAYS,
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
