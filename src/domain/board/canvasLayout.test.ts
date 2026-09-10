import { describe, expect, it } from 'vitest';

import {
  applyGesture,
  columnsFor,
  placeAll,
  MIN_CARD_H,
  MIN_CARD_PX,
  ROW_STEP,
  tidy,
} from './canvasLayout';

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

  it('REMOVES the cap when dragged back past the end of the content', () => {
    // Not "a very tall cap": that behaves identically today and starts
    // clipping silently once the note grows past it.
    const capped = { ...origin, hMax: 400 };
    const next = applyGesture('height', capped, { dx: 0, dy: 300, canvasWidth, natural: 600 });
    expect(next.hMax).toBe(0);
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
