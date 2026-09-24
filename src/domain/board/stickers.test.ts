import { describe, expect, it } from 'vitest';

import {
  addSticker,
  dropSticker,
  freeStickers,
  stickersOnCard,
  clampX,
  moveSticker,
  parseStickers,
  removeSticker,
  STICKER_EMOJI,
  STICKER_GROUPS,
  stickerLabel,
  stickerMigrationPlan,
  stickerStorageKey,
  stickerTilt,
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

describe('the palette', () => {
  it('has the car for discharge, and a label for every sticker', () => {
    expect(STICKER_EMOJI).toContain('🚗');
    expect(stickerLabel('🚗')).toBe('Pulang');
    for (const group of STICKER_GROUPS) {
      for (const sticker of group.stickers) expect(sticker.label.length).toBeGreaterThan(0);
    }
  });

  it('never lists the same sticker twice', () => {
    expect(new Set(STICKER_EMOJI).size).toBe(STICKER_EMOJI.length);
  });

  it('falls back to the emoji itself for one no longer in the palette', () => {
    expect(stickerLabel('🦄')).toBe('🦄');
  });
});

describe('stickerTilt', () => {
  it('is stable per id and stays within ±8°', () => {
    expect(stickerTilt('st-1')).toBe(stickerTilt('st-1'));
    for (const id of ['a', 'st-123-4', 'zzzz', '']) {
      expect(Math.abs(stickerTilt(id))).toBeLessThanOrEqual(8);
    }
  });
});

describe('stickerStorageKey', () => {
  it('gives each scope its own key', () => {
    expect(stickerStorageKey('mine')).not.toBe(stickerStorageKey('temporary'));
    expect(stickerStorageKey('mine')).toContain('mine');
  });
});

describe('stickerMigrationPlan', () => {
  it("migrates 'mine' once, when it has never had its own key and the old one has stickers", () => {
    expect(stickerMigrationPlan('mine', null, '[{"id":"s1"}]')).toBe('migrate-legacy');
  });

  it("never migrates into 'temporary': the old key was never that scope's", () => {
    expect(stickerMigrationPlan('temporary', null, '[{"id":"s1"}]')).toBe('fresh');
  });

  it('uses the scoped key once it exists, even if empty, rather than migrating again', () => {
    expect(stickerMigrationPlan('mine', '[]', '[{"id":"s1"}]')).toBe('use-scope');
  });

  it('starts fresh when neither key has anything', () => {
    expect(stickerMigrationPlan('mine', null, null)).toBe('fresh');
  });
});

describe('attaching to a card', () => {
  const free: BoardSticker = { id: 's1', emoji: '🚩', x: 0.2, y: 40 };

  it('attaches on a drop over a card, keeping the free position current', () => {
    const [placed] = dropSticker([free], 's1', { x: 0.5, y: 300 }, { id: 'p1', dx: 12, dy: 8 });
    expect(placed).toEqual({ id: 's1', emoji: '🚩', x: 0.5, y: 300, card: { id: 'p1', dx: 12, dy: 8 } });
  });

  it('detaches on a drop onto empty canvas', () => {
    const attached = { ...free, card: { id: 'p1', dx: 1, dy: 1 } };
    const [placed] = dropSticker([attached], 's1', { x: 0.3, y: 50 }, null);
    expect(placed).toEqual({ id: 's1', emoji: '🚩', x: 0.3, y: 50 });
    expect(placed && 'card' in placed).toBe(false);
  });

  it('splits free stickers from each card’s own', () => {
    const all: BoardSticker[] = [
      free,
      { id: 's2', emoji: '✅', x: 0, y: 0, card: { id: 'p1', dx: 0, dy: 0 } },
      { id: 's3', emoji: '❌', x: 0, y: 0, card: { id: 'p2', dx: 0, dy: 0 } },
    ];
    expect(freeStickers(all).map((s) => s.id)).toEqual(['s1']);
    expect(stickersOnCard(all, 'p1').map((s) => s.id)).toEqual(['s2']);
    // A card not on the board simply never asks: its stickers are not drawn.
    expect(stickersOnCard(all, 'gone')).toEqual([]);
  });

  it('reads an attachment back, and frees one it cannot read', () => {
    const raw = JSON.stringify([
      { id: 'a', emoji: '🚩', x: 0.1, y: 1, card: { id: 'p1', dx: 3, dy: 4 } },
      { id: 'b', emoji: '🚩', x: 0.1, y: 1, card: { id: 'p1', dx: 'x' } },
    ]);
    const [a, b] = parseStickers(raw);
    expect(a?.card).toEqual({ id: 'p1', dx: 3, dy: 4 });
    expect(b && 'card' in b).toBe(false);
  });
});
