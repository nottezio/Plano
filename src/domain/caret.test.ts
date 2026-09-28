import { describe, expect, it } from 'vitest';

import { mapOffset } from './caret';

describe('mapOffset', () => {
  const before = 'S: sesak\nO: TD 120/80\nA: CHF';

  it('keeps a caret that sits before the change', () => {
    const after = before.replace('CHF', 'CHF NYHA III');
    expect(mapOffset(before, after, 5)).toBe(5);
  });

  it('moves a caret that sits after the change along with its text', () => {
    const after = `Tn. X 60 th\n${before}`;
    const at = before.indexOf('TD');
    expect(after.slice(mapOffset(before, after, at), mapOffset(before, after, at) + 2)).toBe('TD');
  });

  it('puts a caret inside a rewritten span at the end of the new span', () => {
    const b = 'TD 120/80 N 88';
    const a = 'TD 110/70 N 88';
    // Common prefix `TD 1`, common suffix `0 N 88`: the rewritten span is
    // `20/8` -> `10/7`, and the caret goes to its end.
    expect(mapOffset(b, a, 5)).toBe(a.length - '0 N 88'.length);
  });

  it('from an empty box (entry still loading) keeps the caret at the start, not the end', () => {
    expect(mapOffset('', before, 0)).toBe(0);
  });

  it('never returns an offset past the end', () => {
    expect(mapOffset('abcdef', 'ab', 6)).toBe(2);
    expect(mapOffset('abc', 'abc', 10)).toBe(3);
  });
});
