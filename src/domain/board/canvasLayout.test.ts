import { beforeEach, describe, expect, it } from 'vitest';

import {
  GAP_PX,
  MIN_CARD_H,
  MIN_CARD_PX,
  ROW_STEP,
  applyGesture,
  columnsFor,
  mergeLayouts,
  placeAll,
  readArrangement,
  restoreArrangement,
  tidy,
  readLayouts,
  writeArrangement,
  writeLayouts,
} from './canvasLayout';

describe('restoreArrangement', () => {
  const saved = {
    a: { x: 0.5, y: 900, w: 0.4, hMax: 300, hMaxWithNote: true as const },
    gone: { x: 0.1, y: 100, w: 0.2, hMax: 0, shelf: 'rak:old', shelfAt: 1 },
    'rak:removed': { x: 0, y: 0, w: 0.2, hMax: 0, title: 'Lama' },
  };

  it('takes where a card sits from the saved layout, and which shelf it is on from now', () => {
    const current = { a: { x: 0, y: 0, w: 0.25, hMax: 0, shelf: 'rak:1', shelfAt: 5 } };
    expect(restoreArrangement(current, saved).a).toEqual({ x: 0.5, y: 900, w: 0.4, hMax: 300, hMaxWithNote: true, shelf: 'rak:1', shelfAt: 5 });
  });

  it('keeps a shelf made since, and does not bring back one removed since', () => {
    const shelf = { x: 0.2, y: 40, w: 0.3, hMax: 0, title: 'Baru' };
    const next = restoreArrangement({ 'rak:new': shelf }, saved);
    expect(next['rak:new']).toEqual(shelf);
    expect(next['rak:removed']).toBeUndefined();
  });

  it('lets a card admitted since be auto-placed, not sit at its place in the other layout', () => {
    const next = restoreArrangement({ fresh: { x: 0.5, y: 900, w: 0.25, hMax: 0 } }, saved);
    expect(next.fresh).toBeUndefined();
  });

  it('keeps a card only the saved layout knows, off any shelf (the other list on the board)', () => {
    expect(restoreArrangement({}, saved).gone).toEqual({ x: 0.1, y: 100, w: 0.2, hMax: 0 });
  });
});

describe('readArrangement', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    };
  });

  it('keeps each layout apart, and has nothing for one never left', () => {
    writeArrangement('standar', { a: { x: 0.1, y: 10, w: 0.2, hMax: 0 } });
    writeArrangement('kartu', { a: { x: 0.7, y: 70, w: 0.2, hMax: 0 } });
    expect(readArrangement('standar')?.a?.x).toBe(0.1);
    expect(readArrangement('kartu')?.a?.x).toBe(0.7);
    expect(readArrangement('baris')).toBeNull();
  });

  it('survives damaged storage', () => {
    localStorage.setItem('visite.board.canvasByLayout', '{nope');
    expect(readArrangement('standar')).toBeNull();
  });
});

describe('placeAll', () => {
  it('leaves a hand-placed card exactly where it was put', () => {
    const stored = { a: { x: 0.62, y: 480, w: 0.3, hMax: 0 } };
    expect(placeAll(['a'], stored, 4).a).toEqual(stored.a);
  });

  it('gives every card a position, including ones never dragged', () => {
    const placed = placeAll(['a', 'b', 'c'], {}, 3);
    expect(Object.keys(placed)).toEqual(['a', 'b', 'c']);
    for (const layout of Object.values(placed)) {
      expect(Number.isFinite(layout.x)).toBe(true);
      expect(Number.isFinite(layout.y)).toBe(true);
    }
  });

  it('does not drop a new patient underneath a card that was placed by hand', () => {
    // The failure this exists to prevent: a patient admitted since the board
    // was arranged lands under an existing card, is invisible, and reads as
    // never having been created.
    const stored = { placed: { x: 0, y: 0, w: 0.25, hMax: 0 } };
    const result = placeAll(['placed', 'baru'], stored, 4);
    const a = result.placed!;
    const b = result.baru!;
    const horizontal = a.x < b.x + b.w && b.x < a.x + a.w;
    const vertical = a.y < b.y + ROW_STEP && b.y < a.y + ROW_STEP;
    expect(horizontal && vertical).toBe(false);
  });

  it('flows unplaced cards across the columns it was given', () => {
    const placed = placeAll(['a', 'b'], {}, 4);
    expect(placed.a!.y).toBe(0);
    expect(placed.b!.y).toBe(0);
    expect(placed.b!.x).toBeGreaterThan(placed.a!.x);
  });
});

describe('columnsFor', () => {
  it('never returns zero columns, however narrow the canvas', () => {
    expect(columnsFor(100)).toBe(1);
    expect(columnsFor(0)).toBe(1);
  });

  it('caps out rather than shrinking cards indefinitely on a wide monitor', () => {
    expect(columnsFor(6000)).toBe(6);
  });
});

describe('applyGesture', () => {
  const origin = { x: 0.25, y: 200, w: 0.25, hMax: 0 };
  const canvasWidth = 1200;

  it('moves by the pointer delta, in fractions horizontally and pixels down', () => {
    const next = applyGesture('move', origin, { dx: 120, dy: 60, canvasWidth, natural: 0 });
    expect(next.x).toBeCloseTo(0.35);
    expect(next.y).toBe(260);
  });

  it('never lets a card be dragged off the right edge', () => {
    const next = applyGesture('move', origin, { dx: 9000, dy: 0, canvasWidth, natural: 0 });
    expect(next.x + next.w).toBeLessThanOrEqual(1);
  });

  it('never lets a card be dragged above the top of the canvas', () => {
    expect(applyGesture('move', origin, { dx: 0, dy: -9000, canvasWidth, natural: 0 }).y).toBe(0);
  });

  it('will not shrink a card below the readable minimum', () => {
    const next = applyGesture('width', origin, { dx: -9000, dy: 0, canvasWidth, natural: 0 });
    expect(next.w * canvasWidth).toBeGreaterThanOrEqual(MIN_CARD_PX);
  });

  it('leaves position alone when only the width changes', () => {
    const next = applyGesture('width', origin, { dx: 100, dy: 400, canvasWidth, natural: 0 });
    expect(next.x).toBe(origin.x);
    expect(next.y).toBe(origin.y);
  });

  it('sets a cap measured down from the content height', () => {
    const next = applyGesture('height', origin, { dx: 0, dy: -200, canvasWidth, natural: 600 });
    expect(next.hMax).toBe(400);
  });

  it('follows the pointer one-for-one, with nothing snapping', () => {
    // The bug in the 2026-09-12 recording: the old rule compared against a
    // height that the cap itself determined, so any downward movement flipped
    // the card to full height and eight pixels back up flipped it again.
    const capped = { ...origin, hMax: 400 };
    expect(applyGesture('height', capped, { dx: 0, dy: 60, canvasWidth, natural: 400 }).hMax).toBe(
      460,
    );
    expect(applyGesture('height', capped, { dx: 0, dy: -60, canvasWidth, natural: 400 }).hMax).toBe(
      340,
    );
  });

  it('keeps the cap when dragged past the end of the content', () => {
    // Taller than the content is a legitimate thing to ask for, and the only
    // consequence is empty space the user can see and drag back.
    const capped = { ...origin, hMax: 400 };
    expect(
      applyGesture('height', capped, { dx: 0, dy: 500, canvasWidth, natural: 420 }).hMax,
    ).toBe(900);
  });

  it('will not cap a card shorter than its own header', () => {
    const next = applyGesture('height', origin, { dx: 0, dy: -9000, canvasWidth, natural: 600 });
    expect(next.hMax).toBe(MIN_CARD_H);
  });
});

describe('tidy', () => {
  it('closes a hole left by a discharged patient without reordering the rest', () => {
    // b sat between a and c; b is gone. a and c must stay in that order and
    // the gap must not survive as dead space.
    const layouts = {
      a: { x: 0, y: 0, w: 0.25, hMax: 0 },
      c: { x: 0.5, y: 0, w: 0.25, hMax: 0 },
    };
    const result = tidy(['a', 'c'], layouts, 4);
    expect(result.a!.x).toBe(0);
    expect(result.c!.x).toBeCloseTo(0.25);
    expect(result.c!.y).toBe(0);
  });

  it('keeps the reading order the user arranged, not the underlying list order', () => {
    // The board order is a, b — but on screen b is above a.
    const layouts = {
      a: { x: 0, y: 400, w: 0.25, hMax: 0 },
      b: { x: 0, y: 0, w: 0.25, hMax: 0 },
    };
    const result = tidy(['a', 'b'], layouts, 4);
    // Both fit on the first row after tidying, so "b comes first" shows up as
    // b being to the LEFT of a — not above it.
    expect(result.b!.x).toBeLessThan(result.a!.x);
    expect(result.b!.y).toBe(result.a!.y);
  });

  it('reads two cards side by side as one row even at different heights', () => {
    // Nothing hand-placed is ever at exactly the same y; sorting on raw y
    // would interleave columns the eye reads as a single row.
    const layouts = {
      left: { x: 0, y: 12, w: 0.25, hMax: 0 },
      right: { x: 0.3, y: 0, w: 0.25, hMax: 0 },
    };
    const result = tidy(['left', 'right'], layouts, 4);
    expect(result.left!.y).toBe(result.right!.y);
    expect(result.left!.x).toBeLessThan(result.right!.x);
  });

  it('makes each row as tall as its tallest measured card', () => {
    const layouts = {
      short: { x: 0, y: 0, w: 0.5, hMax: 0 },
      long: { x: 0.5, y: 0, w: 0.5, hMax: 0 },
      next: { x: 0, y: 260, w: 0.5, hMax: 0 },
    };
    const packed = tidy(['short', 'long', 'next'], layouts, 2, { short: 100, long: 474, next: 90 });
    expect(packed.next!.y).toBe(474 + GAP_PX);
    const closed = tidy(['short', 'long', 'next'], layouts, 2, { short: 100, long: 120, next: 90 });
    expect(closed.next!.y).toBe(120 + GAP_PX);
  });

  it('keeps the order when pressed again on rows packed closer than ROW_STEP', () => {
    const start = {
      a: { x: 0, y: 0, w: 0.5, hMax: 0 },
      b: { x: 0.5, y: 0, w: 0.5, hMax: 0 },
      c: { x: 0, y: 260, w: 0.5, hMax: 0 },
      d: { x: 0.5, y: 260, w: 0.5, hMax: 0 },
    };
    const heights = { a: 46, b: 46, c: 46, d: 46 };
    const once = tidy(['a', 'b', 'c', 'd'], start, 2, heights);
    expect(tidy(['a', 'b', 'c', 'd'], once, 2, heights)).toEqual(once);
  });

  it('carries widths and height caps through untouched', () => {
    const layouts = { a: { x: 0.4, y: 900, w: 0.5, hMax: 300 } };
    const result = tidy(['a'], layouts, 4);
    expect(result.a!.w).toBe(0.5);
    expect(result.a!.hMax).toBe(300);
  });

  it('wraps a card that would hang off the right edge onto the next row', () => {
    const layouts = {
      wide: { x: 0, y: 0, w: 0.7, hMax: 0 },
      also: { x: 0.75, y: 0, w: 0.5, hMax: 0 },
    };
    const result = tidy(['wide', 'also'], layouts, 4);
    expect(result.also!.y).toBeGreaterThan(0);
    expect(result.also!.x).toBe(0);
  });
});

describe('applyGesture height bounds', () => {
  const capped = { x: 0.25, y: 200, w: 0.25, hMax: 400 };
  const canvasWidth = 1200;

  it('will not shrink past the height that still shows who the patient is', () => {
    // The 2026-09-12 report: at the old fixed floor the header, progress strip
    // and note overlapped each other.
    const next = applyGesture('height', capped, {
      dx: 0,
      dy: -9000,
      canvasWidth,
      natural: 400,
      minH: 190,
      maxH: 700,
    });
    expect(next.hMax).toBe(190);
  });

  it('stops at the height where the whole note is visible', () => {
    // Past that the drag buys empty space and nothing else.
    const next = applyGesture('height', capped, {
      dx: 0,
      dy: 9000,
      canvasWidth,
      natural: 400,
      minH: 190,
      maxH: 700,
    });
    expect(next.hMax).toBe(700);
  });

  it('still tracks the pointer one-for-one between the two ends', () => {
    const next = applyGesture('height', capped, {
      dx: 0,
      dy: 80,
      canvasWidth,
      natural: 400,
      minH: 190,
      maxH: 700,
    });
    expect(next.hMax).toBe(480);
  });

  it('never lets a measured minimum fall below the absolute floor', () => {
    const next = applyGesture('height', capped, {
      dx: 0,
      dy: -9000,
      canvasWidth,
      natural: 400,
      minH: 10,
      maxH: 700,
    });
    expect(next.hMax).toBe(MIN_CARD_H);
  });
});

describe('mergeLayouts', () => {
  const MINE = { a: { x: 0.1, y: 10, w: 0.25, hMax: 0 } };
  const TITIPAN = { t1: { x: 0.5, y: 20, w: 0.25, hMax: 0 } };

  it('KEEPS layouts for cards the current scope cannot see', () => {
    // The 14 September report: dragging a card in Titipan wiped every position
    // in Pasien saya, because the resolved map only ever covers the scope on
    // screen while the store holds every patient.
    const stored = { ...MINE, ...TITIPAN };
    const next = mergeLayouts(stored, TITIPAN, 't1', { x: 0.7, y: 40, w: 0.3, hMax: 0 });
    expect(next.a).toEqual(MINE.a);
    expect(next.t1).toMatchObject({ x: 0.7, y: 40 });
  });

  it('lets the resolved view win for the ids it does cover', () => {
    // This is what freezes the visible board so a commit does not move its
    // neighbours.
    const resolved = { a: { x: 0.4, y: 80, w: 0.25, hMax: 0 } };
    expect(mergeLayouts(MINE, resolved).a).toMatchObject({ x: 0.4, y: 80 });
  });

  it('works with no single card named — a Rapikan or an undo', () => {
    const stored = { ...MINE, ...TITIPAN };
    const next = mergeLayouts(stored, { a: { x: 0, y: 0, w: 0.25, hMax: 0 } });
    expect(next.t1).toEqual(TITIPAN.t1);
    expect(next.a).toMatchObject({ x: 0, y: 0 });
  });

  it('adds a card that was not stored before', () => {
    const next = mergeLayouts({}, {}, 'baru', { x: 0.2, y: 5, w: 0.25, hMax: 0 });
    expect(next.baru).toMatchObject({ x: 0.2 });
  });
});

describe('a height set while the note was open survives a reload', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    };
  });

  it('round-trips the decision with the cap', () => {
    // The bug: this flag lived in memory, so on the next mount the card was
    // uncapped again and sprang back to full height.
    writeLayouts({ p1: { x: 0, y: 0, w: 0.25, hMax: 320, hMaxWithNote: true } });
    expect(readLayouts().p1).toEqual({ x: 0, y: 0, w: 0.25, hMax: 320, hMaxWithNote: true });
  });

  it('drops the flag when there is no cap, so it cannot claim a height nobody set', () => {
    writeLayouts({ p1: { x: 0, y: 0, w: 0.25, hMax: 0, hMaxWithNote: true } });
    expect(readLayouts().p1).toEqual({ x: 0, y: 0, w: 0.25, hMax: 0 });
  });

  it('leaves a layout written before the flag existed alone', () => {
    localStorage.setItem('visite.boardCanvasLayout', JSON.stringify({ p1: { x: 0, y: 0, w: 0.25, hMax: 300 } }));
    expect(readLayouts().p1).toEqual({ x: 0, y: 0, w: 0.25, hMax: 300 });
  });

  it('ignores a flag that is not exactly true', () => {
    localStorage.setItem(
      'visite.boardCanvasLayout',
      JSON.stringify({ p1: { x: 0, y: 0, w: 0.25, hMax: 300, hMaxWithNote: 'yes' } }),
    );
    expect(readLayouts().p1?.hMaxWithNote).toBeUndefined();
  });

  it('keeps the cap and the flag through a merge, as a commit does', () => {
    const merged = mergeLayouts(
      { p1: { x: 0, y: 0, w: 0.25, hMax: 0 }, p2: { x: 0.5, y: 0, w: 0.25, hMax: 0 } },
      { p1: { x: 0, y: 0, w: 0.25, hMax: 0 } },
      'p1',
      { x: 0, y: 0, w: 0.25, hMax: 280, hMaxWithNote: true },
    );
    expect(merged.p1).toMatchObject({ hMax: 280, hMaxWithNote: true });
    // A card the user did not touch is untouched.
    expect(merged.p2).toEqual({ x: 0.5, y: 0, w: 0.25, hMax: 0 });
  });
});

describe('parseSharedCanvas', () => {
  it('accepts a layout mirrored from a laptop', async () => {
    const { parseSharedCanvas } = await import('./canvasLayout');
    const shared = parseSharedCanvas({ layouts: { p1: { x: 0.5, y: 120, w: 0.24, hMax: 0 } }, width: 1180, at: 1 });
    expect(shared?.width).toBe(1180);
    expect(shared?.layouts.p1).toEqual({ x: 0.5, y: 120, w: 0.24, hMax: 0 });
  });

  it('rejects what it cannot draw', async () => {
    const { parseSharedCanvas } = await import('./canvasLayout');
    expect(parseSharedCanvas(null)).toBeNull();
    expect(parseSharedCanvas({ layouts: {}, width: 1180 })).toBeNull();
    expect(parseSharedCanvas({ layouts: { p1: { x: 0, y: 0, w: 0.2 } }, width: 'wide' })).toBeNull();
    // A bad entry is dropped, not the whole layout.
    const shared = parseSharedCanvas({ layouts: { p1: { x: 'NaN', y: 0, w: 0.2 }, p2: { x: 0, y: 0, w: 0.2 } }, width: 1000 });
    expect(Object.keys(shared?.layouts ?? {})).toEqual(['p2']);
  });
});
