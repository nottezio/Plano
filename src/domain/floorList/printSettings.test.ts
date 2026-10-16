import { describe, expect, it } from 'vitest';

import { contentBox, DEFAULT_PRINT, fontPt, pageStarts, readPrintSettings } from './printSettings';

describe('print setup (2026-10-16)', () => {
  it('reads stored settings defensively, keeping what is valid', () => {
    expect(readPrintSettings(null)).toEqual(DEFAULT_PRINT);
    expect(readPrintSettings('{oops')).toEqual(DEFAULT_PRINT);
    expect(readPrintSettings(JSON.stringify({ list: { columns: 9, fontPt: 7.3, landscape: false }, denah: { residentsNewPage: true } }))).toEqual({
      list: { landscape: false, columns: 4, fontPt: 7.5 },
      denah: { ...DEFAULT_PRINT.denah, residentsNewPage: true },
    });
  });

  it('keeps sizes in half points within 5–12 pt', () => {
    expect([fontPt(3, 7), fontPt(30, 7), fontPt('x', 7), fontPt(6.26, 7)]).toEqual([5, 12, 7, 6.5]);
  });

  it('the text box of a page', () => {
    expect(contentBox(false, 10)).toEqual({ width: 190, height: 277 });
    expect(contentBox(true, 8)).toEqual({ width: 281, height: 194 });
  });

  it('pages start where a whole block no longer fits, or where a break is forced', () => {
    const blocks = [
      { top: 0, bottom: 40 },
      { top: 40, bottom: 90 },
      { top: 90, bottom: 130 }, // does not fit on page 1 (100): page 2 starts at 90
      { top: 130, bottom: 150, breakBefore: true }, // forced: page 3 at 130
      { top: 150, bottom: 400 }, // taller than a page: starts page 4, runs over into 5 and 6
    ];
    expect(pageStarts(blocks, 100)).toEqual([0, 90, 130, 150, 250, 350]);
    expect(pageStarts([], 100)).toEqual([0]);
  });
});
