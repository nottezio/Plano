import { describe, expect, it } from 'vitest';

import { isMarked, resolveMarks, toggleMarks } from './lineMarks';

const body = 'S: batuk\nO: TD 120/80\nA: CAP\nP: cek DL';

describe('lineMarks', () => {
  it('marks every line a selection touches, and unmarks them all on a second press', () => {
    const marked = toggleMarks(body, [], 0, body.indexOf('A:'));
    expect(resolveMarks(body, marked).map((s) => body.slice(s.start, s.end))).toEqual(['S: batuk', 'O: TD 120/80', 'A: CAP']);
    expect(toggleMarks(body, marked, 0, body.indexOf('A:'))).toEqual([]);
  });

  it('drops the mark when its line is edited', () => {
    const marked = toggleMarks(body, [], 0, 0);
    expect(resolveMarks(body.replace('batuk', 'batuk reda'), marked)).toEqual([]);
  });

  it('is pressed only on a marked line', () => {
    const marked = toggleMarks(body, [], body.indexOf('O:'), body.indexOf('O:'));
    expect(isMarked(body, marked, body.indexOf('O:') + 2)).toBe(true);
    expect(isMarked(body, marked, 0)).toBe(false);
  });
});
