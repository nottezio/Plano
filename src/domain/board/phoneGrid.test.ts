import { describe, expect, it } from 'vitest';

import { compactGrid, gridRows, moveBlock, placeGrid, readingOrder, sanitizePhoneGrid } from './phoneGrid';

describe('placeGrid', () => {
  it('keeps stored cells and fills the rest in reading order', () => {
    const grid = placeGrid(['a', 'b', 'c', 'd'], { b: { c: 0, r: 0 } }, 3);
    expect(grid).toEqual({ b: { c: 0, r: 0 }, a: { c: 1, r: 0 }, c: { c: 2, r: 0 }, d: { c: 0, r: 1 } });
  });

  it('re-places a block whose cell is taken or off this grid', () => {
    const grid = placeGrid(['a', 'b', 'c'], { a: { c: 0, r: 0 }, b: { c: 0, r: 0 }, c: { c: 5, r: 0 } }, 3);
    expect(grid.a).toEqual({ c: 0, r: 0 });
    expect(grid.b).toEqual({ c: 1, r: 0 });
    expect(grid.c).toEqual({ c: 2, r: 0 });
  });
});

describe('moveBlock', () => {
  it('moves into an empty cell, leaving a gap', () => {
    const next = moveBlock({ a: { c: 0, r: 0 }, b: { c: 1, r: 0 } }, 'a', { c: 2, r: 3 });
    expect(next.a).toEqual({ c: 2, r: 3 });
    expect(gridRows(next)).toBe(4);
  });

  it('swaps with the block already there', () => {
    const next = moveBlock({ a: { c: 0, r: 0 }, b: { c: 1, r: 0 } }, 'a', { c: 1, r: 0 });
    expect(next).toEqual({ a: { c: 1, r: 0 }, b: { c: 0, r: 0 } });
  });
});

describe('readingOrder', () => {
  it('reads the laptop canvas row by row, left to right', () => {
    const order = readingOrder(['x', 'y', 'z', 'new'], {
      x: { x: 0.5, y: 0, w: 0.2, hMax: 0 },
      y: { x: 0, y: 10, w: 0.2, hMax: 0 },
      z: { x: 0, y: 400, w: 0.2, hMax: 0 },
    });
    expect(order).toEqual(['y', 'x', 'z', 'new']);
  });
});

describe('compactGrid', () => {
  it('packs blocks up and left in their order', () => {
    expect(compactGrid({ a: { c: 2, r: 4 }, b: { c: 0, r: 1 } }, 3)).toEqual({ b: { c: 0, r: 0 }, a: { c: 1, r: 0 } });
  });
});

describe('sanitizePhoneGrid', () => {
  it('drops bad cells and clamps to the column count', () => {
    const grid = sanitizePhoneGrid({ cells: { a: { c: 1, r: 0 }, b: { c: 'x', r: 0 }, c: { c: 4, r: 2 } } }, 3);
    expect(grid).toEqual({ a: { c: 1, r: 0 }, c: { c: 2, r: 2 } });
  });
});
