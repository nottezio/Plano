import { describe, expect, it } from 'vitest';

import { parseIdSet, toggled } from './usePersistentIdSet';

describe('parseIdSet', () => {
  it('reads a stored list', () => {
    expect([...parseIdSet('["a","b"]')]).toEqual(['a', 'b']);
  });

  it('treats missing, corrupt and wrong-shaped values as empty', () => {
    expect(parseIdSet(null).size).toBe(0);
    expect(parseIdSet('{not json').size).toBe(0);
    expect(parseIdSet('{"a":1}').size).toBe(0);
  });

  it('keeps only strings', () => {
    expect([...parseIdSet('["a",3,null,"b"]')]).toEqual(['a', 'b']);
  });
});

describe('toggled', () => {
  it('adds and removes one id, leaving the rest', () => {
    const start = new Set(['a', 'b']);
    expect([...toggled(start, 'c')]).toEqual(['a', 'b', 'c']);
    expect([...toggled(start, 'a')]).toEqual(['b']);
    // The original is untouched.
    expect([...start]).toEqual(['a', 'b']);
  });
});
