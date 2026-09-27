import { describe, expect, it } from 'vitest';

import { adoptRemote } from './useSyncedDraft';

describe('adoptRemote', () => {
  it('ignores a snapshot that did not change the value', () => {
    expect(adoptRemote({ current: 'typed', remote: 'old', lastRemote: 'old', pending: false })).toBe('typed');
  });

  it('never overwrites typing that has not been sent yet', () => {
    expect(adoptRemote({ current: 'abc', remote: 'phone', lastRemote: 'a', pending: true })).toBe('abc');
  });

  it('adopts an edit from another device on an idle field', () => {
    expect(adoptRemote({ current: 'a', remote: 'from phone', lastRemote: 'a', pending: false })).toBe(
      'from phone',
    );
  });

  it('keeps a trailing line break the stored form drops', () => {
    const same = (a: string, b: string): boolean => a.trim() === b.trim();
    expect(adoptRemote({ current: 'a\n', remote: 'a', lastRemote: '', pending: false, same })).toBe('a\n');
  });
});
