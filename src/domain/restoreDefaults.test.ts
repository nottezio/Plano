import { describe, expect, it } from 'vitest';

import { restoreMissing, restoreMissingStrings, restoredMessage } from './restoreDefaults';

describe('restoreMissingStrings', () => {
  const seeds = ['Assalamu\u2019alaikum dokter.', 'Selamat pagi dokter.', 'Selamat malam dokter.'];

  it('brings back only what is missing', () => {
    const { next, restored } = restoreMissingStrings([seeds[0]!], seeds);
    expect(restored).toBe(2);
    expect(next).toHaveLength(3);
  });

  it('restores everything when the list was emptied', () => {
    expect(restoreMissingStrings([], seeds).next).toEqual(seeds);
  });

  it('never duplicates what is already there', () => {
    const { next, restored } = restoreMissingStrings(seeds, seeds);
    expect(restored).toBe(0);
    expect(next).toEqual(seeds);
  });

  it('leaves the user\u2019s own entries untouched and first', () => {
    const custom = ['Salam khusus saya.'];
    const { next } = restoreMissingStrings(custom, seeds);
    expect(next[0]).toBe('Salam khusus saya.');
    expect(next).toHaveLength(4);
  });

  it('treats a difference in case or spacing as the same entry', () => {
    const { restored } = restoreMissingStrings(['selamat  pagi   dokter.'], [seeds[1]!]);
    expect(restored).toBe(0);
  });

  it('does not revert an edited entry', () => {
    // The point of merging: restoring must not be a second way to lose work.
    const edited = ['Selamat pagi Prof.'];
    const { next } = restoreMissingStrings(edited, [seeds[1]!]);
    expect(next).toContain('Selamat pagi Prof.');
    expect(next).toHaveLength(2);
  });
});

describe('restoreMissing with keys', () => {
  const seeds = [
    { id: 'a', name: 'Follow-up harian' },
    { id: 'b', name: 'Pasien baru' },
  ];

  it('keys on the chosen field, not object identity', () => {
    const current = [{ id: 'zzz', name: 'follow-up harian' }];
    const { restored, next } = restoreMissing(current, seeds, (item) => item.name);
    expect(restored).toBe(1);
    expect(next).toHaveLength(2);
  });
});

describe('restoredMessage', () => {
  it('says nothing was needed when nothing was', () => {
    expect(restoredMessage(0)).toBe('Semua format bawaan sudah ada.');
  });

  it('counts what came back', () => {
    expect(restoredMessage(2)).toBe('2 format bawaan dipulihkan.');
  });
});
