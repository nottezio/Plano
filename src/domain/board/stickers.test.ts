import { describe, expect, it } from 'vitest';

import {
  addSticker,
  clampX,
  moveSticker,
  parseStickers,
  removeSticker,
  type BoardSticker,
} from './stickers';

const one: BoardSticker = { id: 's1', emoji: '🚩', x: 0.5, y: 120 };

describe('parseStickers', () => {
  it('reads what it wrote', () => {
    expect(parseStickers(JSON.stringify([one]))).toEqual([one]);
  });

  it('treats missing and corrupt storage as none', () => {
    expect(parseStickers(null)).toEqual([]);
    expect(parseStickers('{oops')).toEqual([]);
    expect(parseStickers('{"not":"an array"}')).toEqual([]);
  });

  it('drops entries that are not stickers rather than failing the board', () => {
    const raw = JSON.stringify([one, { id: 's2' }, null, { ...one, id: 's3', x: 'x' }]);
    expect(parseStickers(raw).map((sticker) => sticker.id)).toEqual(['s1']);
  });

  it('refuses a position that is not a number, including NaN', () => {
    expect(parseStickers(JSON.stringify([{ ...one, y: Number.NaN }]))).toEqual([]);
  });

  it('pulls a stored position back onto the canvas', () => {
    expect(parseStickers(JSON.stringify([{ ...one, x: 4, y: -50 }]))[0]).toMatchObject({
      x: 0.97,
      y: 0,
    });
  });
});

describe('moving', () => {
  it('moves only the one asked for', () => {
    const two = [one, { ...one, id: 's2' }];
    const moved = moveSticker(two, 's2', 0.2, 40);
    expect(moved[0]).toEqual(one);
    expect(moved[1]).toMatchObject({ x: 0.2, y: 40 });
  });

  it('keeps a sticker on the canvas', () => {
    expect(clampX(-1)).toBe(0);
    expect(clampX(2)).toBe(0.97);
    expect(moveSticker([one], 's1', 1.5, -10)[0]).toMatchObject({ x: 0.97, y: 0 });
  });
});

describe('adding and removing', () => {
  it('adds at the end, clamped', () => {
    const added = addSticker([one], { id: 's2', emoji: '✅', x: 1.4, y: -5 });
    expect(added).toHaveLength(2);
    expect(added[1]).toEqual({ id: 's2', emoji: '✅', x: 0.97, y: 0 });
  });

  it('removes one and leaves the rest', () => {
    expect(removeSticker([one, { ...one, id: 's2' }], 's1').map((s) => s.id)).toEqual(['s2']);
  });
});
