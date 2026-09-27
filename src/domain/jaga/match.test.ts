import { describe, expect, it } from 'vitest';

import { jarkomFor, matchJarkom, resolveJarkom } from './match';
import type { JarkomDirectory } from './types';

/*
  Invented names with the SAME shape as the reported case: a legend typo
  ("Rendi" for "Refki", two letters off) that shares two words with each of
  two rows, one of them a common given name that four rows carry.
*/
const DIRECTORY: JarkomDirectory = {
  importedAt: '2026-09-27T00:00:00Z',
  entries: [
    { name: 'dr. Bayu Sutan Wirawan', panggilan: 'Wira', muslim: true },
    { name: 'dr. Bayu Rendi Pratama', panggilan: 'Rendi', muslim: true },
    { name: 'dr. Bayu Refki Hakim', panggilan: 'Hakim', muslim: true },
    { name: 'dr. Bayu Salman Toana', panggilan: 'Salman', muslim: false },
    { name: 'dr. Clara Wenas', panggilan: 'Clara', muslim: false },
  ],
};

describe('resolveJarkom', () => {
  it('refuses to choose between two rows that fit equally, and names them', () => {
    const result = resolveJarkom('dr. Bayu Rendi Hakim', DIRECTORY);
    expect(result.entry).toBeNull();
    expect(result.ambiguous.map((entry) => entry.panggilan).sort()).toEqual(['Hakim', 'Rendi']);
  });

  it('still matches a name that fits one row best', () => {
    expect(matchJarkom('dr. Bayu Refki Hakim', DIRECTORY)?.panggilan).toBe('Hakim');
    expect(matchJarkom('Bayu Rendi Pratama', DIRECTORY)?.panggilan).toBe('Rendi');
  });

  it('lets a rare shared word outrank a common one at the same share', () => {
    // "wenas" is on one row, "bayu" on four: same count of words, not the same evidence.
    const directory: JarkomDirectory = {
      ...DIRECTORY,
      entries: [...DIRECTORY.entries, { name: 'dr. Bayu Clara', panggilan: 'BC', muslim: true }],
    };
    expect(matchJarkom('Clara Wenas Bayu', directory)?.panggilan).toBe('Clara');
  });

  it('a hand link wins, supplies the row, and is dropped if the row is gone', () => {
    const links = { BRH: 'dr. Bayu Refki Hakim' };
    const linked = jarkomFor('BRH', 'dr. Bayu Rendi Hakim', DIRECTORY, links);
    expect(linked).toMatchObject({ linked: true, entry: { panggilan: 'Hakim' } });

    const stale = jarkomFor('BRH', 'dr. Bayu Rendi Hakim', DIRECTORY, { BRH: 'dr. Nobody' });
    expect(stale.linked).toBe(false);
    expect(stale.ambiguous).toHaveLength(2);
  });
});
