import { describe, expect, it } from 'vitest';

import { DEFAULT_ONSITE_IGD, onsiteFor, onsiteSchedule } from './onsite';

describe('onsiteFor (Avi, 2026-10-12)', () => {
  it('follows the default weekday schedule', () => {
    // 12-10-2026 is a Monday.
    const week = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'];
    expect(week.map((date) => onsiteFor(date)?.initials)).toEqual(['KS', 'ZD', 'AHN', 'MAA', 'AHA', 'MZ']);
  });

  it('is nobody on Sunday or for a date it cannot read', () => {
    expect(onsiteFor('2026-10-18')).toBeNull();
    expect(onsiteFor('Senin')).toBeNull();
  });

  it('gives a MALAM team the line only on a flagged day (Saturday by default)', () => {
    expect(onsiteFor('2026-10-17', 'malam')?.initials).toBe('MZ');
    expect(onsiteFor('2026-10-16', 'malam')).toBeNull();
    expect(onsiteFor('2026-10-17', 'pagi')?.initials).toBe('MZ');
  });

  it('reads an edited schedule; an unknown id prints nothing', () => {
    const edited = onsiteSchedule({ '1': { id: 'zd', malam: false }, '2': { id: 'nobody', malam: false } });
    expect(onsiteFor('2026-10-12', 'penuh', edited)?.initials).toBe('ZD');
    expect(onsiteFor('2026-10-13', 'penuh', edited)).toBeNull();
  });
});

describe('onsiteSchedule', () => {
  it('is the default when nothing is saved', () => {
    expect(onsiteSchedule(undefined)).toEqual(DEFAULT_ONSITE_IGD);
    expect(onsiteSchedule(null)).toEqual(DEFAULT_ONSITE_IGD);
  });

  it('merges per day and per field over the default', () => {
    const merged = onsiteSchedule({ '6': { id: '' }, '0': { malam: true } });
    expect(merged['6']).toEqual({ id: '', malam: true });
    expect(merged['0']).toEqual({ id: '', malam: true });
    expect(merged['1']).toEqual({ id: 'ks', malam: false });
  });
});
