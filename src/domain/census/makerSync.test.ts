import { describe, expect, it } from 'vitest';

import { emptyDay, emptyStore, type SensusDay } from './makerStore';
import { dayPatch, expiredDates, mergeRemoteDays, MAX_DAY_CHARS, tooBigToSync } from './makerSync';

const day = (text: string, extra: Partial<SensusDay> = {}): SensusDay => ({
  ...emptyDay(),
  lists: [{ text, kind: 'auto' }],
  ...extra,
});

describe('dayPatch', () => {
  it('is null when nothing changed, including {} vs absent maps', () => {
    const a = day('List Pasien PJT');
    const { checked: _omit, ...withoutChecked } = a;
    expect(dayPatch(a, a)).toBeNull();
    expect(dayPatch(withoutChecked as SensusDay, a)).toBeNull();
  });

  it('writes the lists whole and the per-DPJP maps leaf by leaf', () => {
    const prev = day('a', { checked: { ARB: ['rm:1'] }, extra: { ARB: ['rm:2'] } });
    const next = day('a b', { checked: { ARB: ['rm:1', 'rm:3'], AHA: ['rm:9'] }, extra: {} });
    expect(dayPatch(prev, next)).toEqual({
      lists: [{ text: 'a b', kind: 'auto' }],
      checked: { ARB: ['rm:1', 'rm:3'], AHA: ['rm:9'] },
      extra: { ARB: null },
    });
  });

  it('only the DPJP whose AI result changed is sent, without undefined fields', () => {
    const prev = day('a', { ai: { ARB: { key: 'k1', text: 'x' } } });
    const next = day('a', { ai: { ARB: { key: 'k1', text: 'x' }, AHA: { key: 'k2', text: 'y', patients: undefined } as unknown as SensusDay['ai'][string] } });
    const patch = dayPatch(prev, next);
    expect(patch).toEqual({ ai: { AHA: { key: 'k2', text: 'y' } } });
    expect(Object.keys(patch!.ai!.AHA!)).not.toContain('patients');
  });

  it('a first upload sends everything', () => {
    expect(dayPatch(undefined, day('a'))).toMatchObject({ lists: [{ text: 'a', kind: 'auto' }] });
  });
});

describe('mergeRemoteDays', () => {
  const today = '2026-10-12';
  const local = { ...emptyStore(), days: { '2026-10-12': day('local'), '2026-10-11': day('local kemarin') } };

  it('the account wins for a date not being edited here', () => {
    const merged = mergeRemoteDays(local, { '2026-10-12': day('remote') }, new Set(), new Set(), today);
    expect(merged.days['2026-10-12']!.lists[0]!.text).toBe('remote');
  });

  it('a date with a write waiting keeps the local copy', () => {
    const merged = mergeRemoteDays(local, { '2026-10-12': day('remote') }, new Set(['2026-10-12']), new Set(), today);
    expect(merged.days['2026-10-12']!.lists[0]!.text).toBe('local');
  });

  it('a local date the account never had is kept (waiting for upload)', () => {
    const merged = mergeRemoteDays(local, {}, new Set(), new Set(), today);
    expect(Object.keys(merged.days).sort()).toEqual(['2026-10-11', '2026-10-12']);
  });

  it('a date the account had and removed is removed here', () => {
    const merged = mergeRemoteDays(local, { '2026-10-12': day('local') }, new Set(), new Set(['2026-10-11', '2026-10-12']), today);
    expect(Object.keys(merged.days)).toEqual(['2026-10-12']);
  });

  it('remote days from another device appear (sign-in on a fresh device)', () => {
    const merged = mergeRemoteDays(emptyStore(), { '2026-10-10': day('dari HP') }, new Set(), new Set(), today);
    expect(merged.days['2026-10-10']!.lists[0]!.text).toBe('dari HP');
  });

  it('returns the same store when nothing changes', () => {
    const merged = mergeRemoteDays(local, { ...local.days }, new Set(), new Set(), today);
    expect(merged).toBe(local);
  });
});

describe('limits', () => {
  it('dates older than a week are expired', () => {
    expect(expiredDates(['2026-10-01', '2026-10-05', '2026-10-12'], '2026-10-12')).toEqual(['2026-10-01']);
  });

  it('a day over the document budget stays local', () => {
    expect(tooBigToSync(day('x'.repeat(MAX_DAY_CHARS)))).toBe(true);
    expect(tooBigToSync(day('x'.repeat(1000)))).toBe(false);
  });
});
