import { describe, expect, it } from 'vitest';

import { summarizeEntryDays, type EntryDay } from './entries.repo';
import type { DailyEntry } from '@/domain/types';

const day = (id: string, data: Partial<DailyEntry>): EntryDay => ({ id, data: data as DailyEntry });
const shift = (clearedAt: unknown = null) => ({ id: 'n', time: '20:00', body: 'jaga', clearedAt }) as never;

describe('summarizeEntryDays (the date rail from older and recent days, 2026-11-01)', () => {
  it('keeps the rail rules: body days, jaga-only days, deleted days left out', () => {
    const out = summarizeEntryDays([
      day('2026-10-20', { body: 'S: ...' }),
      day('2026-10-21', { body: '  ', shiftNotes: [shift()] }),
      day('2026-10-22', { body: 'x', deletedAt: {} as never }),
      day('2026-10-23', { body: '', shiftNotes: [shift({})] }),
      day('igd', { body: 'IGD' }),
    ]);
    expect(out.dates.sort()).toEqual(['2026-10-20', '2026-10-21', 'igd']);
    expect(out.datesWithBody.sort()).toEqual(['2026-10-20', 'igd']);
    expect(Object.keys(out.shiftNotesByDate)).toEqual(['2026-10-21']);
  });

  it('joins older days (read once) with the live window, the later copy of a day winning', () => {
    const out = summarizeEntryDays([day('2026-10-20', { body: 'old' }), day('2026-10-30', { body: '' }), day('2026-10-30', { body: 'now written' })]);
    expect(out.datesWithBody.sort()).toEqual(['2026-10-20', '2026-10-30']);
  });
});
