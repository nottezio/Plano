import { describe, expect, it } from 'vitest';

import { groupByDay } from './editionGroups';
import type { Edition } from './floor';

const edition = (id: string, date: string, time: string): Edition => ({
  id,
  date,
  time,
  text: '',
  patients: [],
  createdAt: `${date}T${time.replace('.', ':')}:00.000Z`,
  createdBy: 'x',
});

describe('groupByDay', () => {
  it('groups by date, newest day first, keeping the order inside a day', () => {
    const days = groupByDay([
      edition('a', '2026-10-24', '19.00'),
      edition('b', '2026-10-24', '04.00'),
      edition('c', '2026-10-23', '19.00'),
    ]);
    expect(days.map((d) => [d.date, d.editions.map((e) => e.id)])).toEqual([
      ['2026-10-24', ['a', 'b']],
      ['2026-10-23', ['c']],
    ]);
  });

  it('puts an edition saved late for an earlier date under that date', () => {
    const days = groupByDay([edition('late', '2026-10-22', '19.00'), edition('a', '2026-10-24', '04.00'), edition('b', '2026-10-22', '04.00')]);
    expect(days.map((d) => d.date)).toEqual(['2026-10-24', '2026-10-22']);
    expect(days[1]?.editions.map((e) => e.id)).toEqual(['late', 'b']);
  });

  it('is empty for no editions', () => {
    expect(groupByDay([])).toEqual([]);
  });
});
