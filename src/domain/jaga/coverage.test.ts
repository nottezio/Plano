import { describe, expect, it } from 'vitest';

import { describeDates, dpjpGaps, missingDates } from './coverage';
import type { DpjpRoster } from './types';

const october = (days: number[]): string[] =>
  days.map((day) => `2026-10-${String(day).padStart(2, '0')}`);

describe('missingDates', () => {
  it('finds the four days the October DPJP import silently lost', () => {
    const parsed = october([1, 2, 3, 4, 9, 10, ...Array.from({ length: 21 }, (_, i) => i + 11)]);
    expect(missingDates(parsed, { wholeMonths: true })).toEqual(october([5, 6, 7, 8]));
  });

  it('a whole-month sheet starting late is missing its first days', () => {
    expect(missingDates(october([3, 4]), { wholeMonths: true }).slice(0, 2)).toEqual(october([1, 2]));
    expect(missingDates(october([3, 4]), { wholeMonths: true })).toHaveLength(29);
  });

  it('a mid-month roster counts only the holes inside it', () => {
    const roster = [...october([30, 31]), '2026-11-01', '2026-11-03'];
    expect(missingDates(roster)).toEqual(['2026-11-02']);
  });

  it('nothing imported is nothing missing', () => {
    expect(missingDates([])).toEqual([]);
  });
});

describe('describeDates', () => {
  it('folds runs into ranges', () => {
    expect(describeDates(october([5, 6, 7, 8, 24]))).toBe('5–8 Okt, 24 Okt');
    expect(describeDates(['2026-10-31', '2026-11-01'])).toBe('31 Okt–1 Nov');
    expect(describeDates([])).toBe('');
  });
});

describe('dpjpGaps', () => {
  const dpjp: DpjpRoster = {
    title: 'JADWAL JAGA DPJP',
    importedAt: '2026-10-01T00:00:00.000Z',
    days: [
      { date: '2026-10-05', utama: 'dr. A', tindakan: 'dr. B' },
      { date: '2026-10-08', utama: 'dr. C', tindakan: 'dr. D' },
    ],
  };

  it('a weekday team needs its date and the next one (the after-midnight block)', () => {
    expect(dpjpGaps({ date: '2026-10-05', shift: 'penuh' }, dpjp)).toEqual(['2026-10-06']);
    expect(dpjpGaps({ date: '2026-10-06', shift: 'penuh' }, dpjp)).toEqual(['2026-10-06', '2026-10-07']);
  });

  it('a pagi team needs only its own date', () => {
    expect(dpjpGaps({ date: '2026-10-05', shift: 'pagi' }, dpjp)).toEqual([]);
  });

  it('a hand-entered DPJP fills a gap', () => {
    expect(
      dpjpGaps({ date: '2026-10-06', shift: 'penuh' }, dpjp, { '2026-10-06': { utama: 'dr. E' } }),
    ).toEqual(['2026-10-07']);
  });

  it('no sheet at all means every date is a gap', () => {
    expect(dpjpGaps({ date: '2026-10-05', shift: 'malam' }, null)).toEqual(['2026-10-05', '2026-10-06']);
  });
});
