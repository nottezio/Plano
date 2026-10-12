import { describe, expect, it } from 'vitest';

import { onsiteFor } from './onsite';

describe('onsiteFor (Avi, 2026-10-12)', () => {
  it('follows the weekday schedule', () => {
    // 12-10-2026 is a Monday.
    const week = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'];
    expect(week.map((date) => onsiteFor(date)?.initials)).toEqual(['KS', 'ZD', 'AHN', 'MAA', 'AHA', 'MZ']);
  });

  it('is nobody on Sunday or for a date it cannot read', () => {
    expect(onsiteFor('2026-10-18')).toBeNull();
    expect(onsiteFor('Senin')).toBeNull();
  });
});
