import { describe, expect, it } from 'vitest';

import {
  compareSuggestions,
  defaultPartner,
  groupCompareOptions,
  relativeDay,
  type CompareEntry,
  type OpenNote,
} from './compareOptions';

const ENTRIES: CompareEntry[] = [
  { key: '2026-10-04#versi-1', date: '2026-10-04', kind: 'versi', time: '08.10', label: 'Versi dr. AHA' },
  { key: '2026-10-04#jaga-1', date: '2026-10-04', kind: 'jaga', time: '02.10', label: 'Jaga 02.10' },
  { key: '2026-10-04', date: '2026-10-04', kind: 'harian' },
  { key: '2026-10-02', date: '2026-10-02', kind: 'harian' },
  { key: '2026-09-30#jaga-2', date: '2026-09-30', kind: 'jaga', time: '22.00', label: 'Jaga 22.00' },
];

const SOAP_OPEN: OpenNote = { date: '2026-10-04', kind: 'harian', name: 'SOAP' };
const VERSION_OPEN: OpenNote = { date: '2026-10-04', kind: 'versi', name: 'Versi dr. AHA' };

describe('groupCompareOptions', () => {
  it('groups by date, newest first, the open note in its own day', () => {
    const groups = groupCompareOptions(ENTRIES, SOAP_OPEN, '2026-10-04');
    expect(groups.map((group) => group.date)).toEqual(['2026-10-04', '2026-10-02', '2026-09-30']);
    expect(groups[0]!.options.map((option) => [option.key, option.name, option.open])).toEqual([
      [null, 'SOAP', true],
      ['2026-10-04#versi-1', 'Versi dr. AHA', false],
      ['2026-10-04#jaga-1', 'Jaga 02.10', false],
    ]);
    expect(groups[1]!.relative).toBe('H-2');
  });

  it('keeps a date that only holds the open note', () => {
    const groups = groupCompareOptions([], SOAP_OPEN, '2026-10-04');
    expect(groups).toHaveLength(1);
    expect(groups[0]!.relative).toBe('hari yang sama');
  });
});

describe('compareSuggestions', () => {
  it('offers the original SOAP and the day before for a version', () => {
    const suggestions = compareSuggestions(ENTRIES, VERSION_OPEN, '2026-10-04#versi-1');
    expect(suggestions.map((entry) => [entry.label, entry.key])).toEqual([
      ['SOAP asli', '2026-10-04'],
      ['Hari sebelumnya', '2026-10-02'],
    ]);
  });

  it('offers the previous day and the day’s versions for the SOAP', () => {
    const suggestions = compareSuggestions(ENTRIES, SOAP_OPEN, '2026-10-04');
    expect(suggestions.map((entry) => entry.label)).toEqual(['Hari sebelumnya', 'Versi dr. AHA']);
    expect(defaultPartner(ENTRIES, SOAP_OPEN, '2026-10-04')).toBe('2026-10-02');
  });

  it('falls back to the newest other note', () => {
    const only = [ENTRIES[1]!];
    expect(defaultPartner(only, SOAP_OPEN, '2026-10-04')).toBe('2026-10-04#jaga-1');
    expect(defaultPartner([], SOAP_OPEN, '2026-10-04')).toBeNull();
  });
});

describe('relativeDay', () => {
  it('counts from the open note', () => {
    expect(relativeDay('2026-10-03', '2026-10-04')).toBe('H-1');
    expect(relativeDay('2026-10-05', '2026-10-04')).toBe('H+1');
    expect(relativeDay('igd', '2026-10-04')).toBe('');
  });
});
