import { beforeEach, describe, expect, it } from 'vitest';

import {
  applyJagaState,
  applyRosterKind,
  claimJagaLocal,
  countShiftEdits,
  readConfirmed,
  readDpjpEdit,
  readPostOverrides,
  resetShiftEdits,
  readJagaState,
  readReligion,
  setDpjpEdit,
  setJagaRemote,
  setNameOverride,
  setPostOverride,
  setReligion,
  writeConfirmed,
  writeRoster,
  writeSender,
  type JagaRemote,
} from './store';
import type { JagaRoster } from './types';

/** A Map-backed localStorage, enough for the store (the suite runs in node). */
function installStorage(): void {
  const data = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
  };
}

type Call = [string, ...unknown[]];

function recordingRemote(calls: Call[]): JagaRemote {
  return {
    putRoster: (kind, value) => calls.push(['roster', kind, value]),
    putState: (field, key, value) => calls.push(['state', field, key, value]),
  };
}

const ROSTER: JagaRoster = {
  title: 'Sep',
  shifts: [],
  initials: {},
  importedAt: '2026-09-01T00:00:00.000Z',
};

describe('local writes reach the account one key at a time', () => {
  let calls: Call[];

  beforeEach(() => {
    installStorage();
    calls = [];
    setJagaRemote(recordingRemote(calls));
  });

  it('sends a roster whole', () => {
    writeRoster(ROSTER);
    expect(calls).toEqual([['roster', 'roster', ROSTER]]);
  });

  it('sends a confirmation tick under its date and shift only', () => {
    writeConfirmed('2026-09-18', 'malam', new Set(['igdA']));
    expect(calls).toEqual([['state', 'confirmed', '2026-09-18:malam', ['igdA']]]);
  });

  it('deletes a cleared name override rather than sending a blank', () => {
    setNameOverride('AV', 'Avicenna');
    setNameOverride('AV', '  ');
    expect(calls.at(-1)).toEqual(['state', 'names', 'AV', null]);
  });

  it('deletes the day key when its last swap is cleared', () => {
    setPostOverride('2026-09-18', 'malam', 'igdA', { name: 'Budi' });
    setPostOverride('2026-09-18', 'malam', 'igdA', null);
    expect(calls).toEqual([
      ['state', 'posts', '2026-09-18:malam', { igdA: { name: 'Budi' } }],
      ['state', 'posts', '2026-09-18:malam', null],
    ]);
  });

  it('sends religion and DPJP edits, and deletes them when cleared', () => {
    setReligion('AV', true);
    setReligion('AV', null);
    setDpjpEdit('2026-09-18', { utama: 'dr. X' });
    setDpjpEdit('2026-09-18', {});
    expect(calls).toEqual([
      ['state', 'religion', 'AV', true],
      ['state', 'religion', 'AV', null],
      ['state', 'dpjpEdits', '2026-09-18', { utama: 'dr. X' }],
      ['state', 'dpjpEdits', '2026-09-18', null],
    ]);
  });

  it('sends the sender as one field', () => {
    writeSender({ name: 'Avi', place: 'PJT' });
    expect(calls).toEqual([['state', 'sender', null, { name: 'Avi', place: 'PJT' }]]);
  });

  it('writes locally and sends nothing when signed out', () => {
    setJagaRemote(null);
    setReligion('AV', false);
    expect(calls).toEqual([]);
    expect(readReligion()).toEqual({ AV: false });
  });
});

describe('changes from the account are stored without echoing back', () => {
  let calls: Call[];

  beforeEach(() => {
    installStorage();
    calls = [];
    setJagaRemote(recordingRemote(calls));
  });

  it('applies a roster and reports whether anything changed', () => {
    expect(applyRosterKind('roster', ROSTER)).toBe(true);
    expect(applyRosterKind('roster', ROSTER)).toBe(false);
    expect(calls).toEqual([]);
  });

  it('applies state field by field and round-trips through readJagaState', () => {
    const state = {
      sender: { name: 'Avi', place: 'PJT' },
      confirmed: { '2026-09-18:malam': ['igdA'] },
      names: { AV: 'Avicenna' },
    };
    expect(applyJagaState(state)).toBe(true);
    expect(applyJagaState(state)).toBe(false);
    expect(readJagaState()).toEqual(state);
    expect(calls).toEqual([]);
  });
});

describe('claimJagaLocal — a shared PC', () => {
  beforeEach(() => {
    installStorage();
    setJagaRemote(null);
  });

  it('gives unclaimed data to the first account that syncs', () => {
    setReligion('AV', true);
    expect(claimJagaLocal('avi')).toBe(false);
    expect(readReligion()).toEqual({ AV: true });
  });

  it('keeps the data for the same account', () => {
    claimJagaLocal('avi');
    setReligion('AV', true);
    expect(claimJagaLocal('avi')).toBe(false);
    expect(readReligion()).toEqual({ AV: true });
  });

  it("clears another account's copy before a different account syncs", () => {
    claimJagaLocal('avi');
    setReligion('AV', true);
    writeRoster(ROSTER);
    expect(claimJagaLocal('colleague')).toBe(true);
    expect(readReligion()).toEqual({});
    expect(readJagaState()).toEqual({});
    expect(applyRosterKind('roster', ROSTER)).toBe(true);
  });
});

describe('resetShiftEdits', () => {
  let calls: Call[];
  const DATES = ['2026-09-18', '2026-09-19'];

  beforeEach(() => {
    installStorage();
    calls = [];
    setJagaRemote(recordingRemote(calls));
    setPostOverride('2026-09-18', 'malam', 'igdA', { name: 'Budi' });
    setPostOverride('2026-09-18', 'pagi', 'igdA', { name: 'Lain shift' });
    setDpjpEdit('2026-09-19', { utama: 'dr. X' });
    writeConfirmed('2026-09-18', 'malam', new Set(['igdA', 'cvcu']));
    setNameOverride('AV', 'Avicenna');
    calls.length = 0;
  });

  it('counts what it would clear', () => {
    expect(countShiftEdits('2026-09-18', 'malam', DATES)).toEqual({ swaps: 1, dpjp: 1 });
  });

  it('clears the swaps and DPJP swaps, and the ticks of swapped posts only', () => {
    resetShiftEdits('2026-09-18', 'malam', DATES);
    expect(readPostOverrides('2026-09-18', 'malam')).toEqual({});
    expect(readDpjpEdit('2026-09-19')).toEqual({});
    expect([...readConfirmed('2026-09-18', 'malam')]).toEqual(['cvcu']);
    expect(countShiftEdits('2026-09-18', 'malam', DATES)).toEqual({ swaps: 0, dpjp: 0 });
  });

  it('leaves the other shift and the name corrections alone', () => {
    resetShiftEdits('2026-09-18', 'malam', DATES);
    expect(readPostOverrides('2026-09-18', 'pagi')).toEqual({ igdA: { name: 'Lain shift' } });
    expect(calls.some(([, field]) => field === 'names')).toBe(false);
  });

  it('syncs each cleared key as a deletion', () => {
    resetShiftEdits('2026-09-18', 'malam', DATES);
    expect(calls).toEqual([
      ['state', 'posts', '2026-09-18:malam', null],
      ['state', 'dpjpEdits', '2026-09-19', null],
      ['state', 'confirmed', '2026-09-18:malam', ['cvcu']],
    ]);
  });

  it('does nothing when there is nothing to reset', () => {
    resetShiftEdits('2026-09-20', 'malam', ['2026-09-20', '2026-09-21']);
    expect(calls).toEqual([]);
  });
});
