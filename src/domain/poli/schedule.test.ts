import { describe, expect, it } from 'vitest';

import { POLI_SCHEDULE, SCHEDULE_PERIOD, nextPoli, weekdayName } from './schedule';
import { DPJPS } from '../dpjp';
import type { ClinicalDate } from '../types';

// 2026-01-05 is a Monday.
const MONDAY = '2026-01-05' as ClinicalDate;

describe('POLI_SCHEDULE', () => {
  it('names the month it was transcribed from', () => {
    // A roster is a document with a date on it; reading last month's by
    // accident is the mistake worth preventing.
    expect(SCHEDULE_PERIOD).toBe('Juli 2026');
  });

  it('covers Monday to Friday, with the split slots the sheet shows', () => {
    // Tuesday and Friday carry six: a clinic split between two consultants at
    // different hours is two rows on the sheet and two slots here.
    const counts = [1, 2, 3, 4, 5].map(
      (weekday) => POLI_SCHEDULE.filter((slot) => slot.weekday === weekday).length,
    );
    expect(counts).toEqual([5, 6, 5, 5, 6]);
  });

  it('links each consultant to the registry where one exists', () => {
    const ids = new Set(DPJPS.map((dpjp) => dpjp.id));
    for (const slot of POLI_SCHEDULE) {
      if (slot.dpjpId) expect(ids.has(slot.dpjpId)).toBe(true);
    }
  });

  it('keeps a consultant who is not in the registry rather than dropping them', () => {
    // The schedule is still correct about them.
    const tasrif = POLI_SCHEDULE.filter((slot) => slot.name.includes('Tasrif'));
    expect(tasrif.length).toBeGreaterThan(0);
    expect(tasrif.every((slot) => slot.dpjpId === null)).toBe(true);
  });

  it('carries the Friday times that differ from the rest of the week', () => {
    const friday = POLI_SCHEDULE.filter((slot) => slot.weekday === 5);
    expect(friday.find((slot) => slot.dpjpId === 'zd')?.time).toBe('08.00 - 12.00');
    expect(friday.find((slot) => slot.dpjpId === 'im')?.time).toBe('13.00 - 16.30');
  });
});

describe('nextPoli', () => {
  it('finds a clinic today when there is one', () => {
    const next = nextPoli('ks', MONDAY);
    expect(next?.inDays).toBe(0);
    expect(next?.slot.clinic).toBe('1 (Cardio PJT)');
    expect(weekdayName(next?.weekday ?? 0)).toBe('Senin');
  });

  it('rolls forward to the next day the consultant is on', () => {
    // Peter Kabo is Tuesday and Thursday; from Monday that is tomorrow.
    const next = nextPoli('pk', MONDAY);
    expect(next?.inDays).toBe(1);
    expect(next?.date).toBe('2026-01-06');
    expect(weekdayName(next?.weekday ?? 0)).toBe('Selasa');
  });

  it('rolls across the weekend into the following week', () => {
    // From Saturday, the next Monday clinic is two days away.
    const saturday = '2026-01-10' as ClinicalDate;
    const next = nextPoli('maa', saturday);
    expect(next?.date).toBe('2026-01-12');
    expect(weekdayName(next?.weekday ?? 0)).toBe('Senin');
  });

  it('returns nothing for a consultant who holds no clinic', () => {
    // Not a failure to find one — they are genuinely not on this roster.
    expect(nextPoli('jk', MONDAY)).toBeNull();
  });

  it('reads the weekday in UTC, so it cannot shift with the device timezone', () => {
    expect(nextPoli('afm', '2026-01-07' as ClinicalDate)?.inDays).toBe(0);
  });
});
