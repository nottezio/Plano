import { describe, expect, it } from 'vitest';

import {
  MAX_POINTS,
  addStroke,
  drawingBottom,
  drawingStorageKey,
  eraseAt,
  parseDrawing,
  simplify,
  strokeHit,
  strokePath,
  type Stroke,
} from './drawing';

const W = 1000;
const line = (id: string, points: number[], tool: Stroke['tool'] = 'pen'): Stroke => ({ id, tool, color: 'ink', points });

describe('storage', () => {
  it('is per scope, beside the stickers', () => {
    expect(drawingStorageKey('mine')).toBe('visite.board.drawing.mine');
    expect(drawingStorageKey('temporary')).not.toBe(drawingStorageKey('mine'));
  });

  it('reads back what it wrote, and drops anything damaged', () => {
    const good = line('a', [0.1, 10, 0.2, 20]);
    const raw = JSON.stringify([good, { id: 'b', tool: 'crayon', color: 'ink', points: [0, 0] }, { id: 'c', tool: 'pen', color: 'ink', points: [0.1] }, null]);
    expect(parseDrawing(raw)).toEqual([good]);
    expect(parseDrawing('not json')).toEqual([]);
    expect(parseDrawing(null)).toEqual([]);
  });
});

describe('simplify', () => {
  it('drops points closer than 2 px to the last kept, keeps both ends', () => {
    // x 0.1000 → 0.1001 is 0.1 px at 1000 px wide.
    const points = [0.1, 10, 0.1001, 10, 0.1002, 10, 0.2, 10, 0.2001, 10.5];
    expect(simplify(points, W)).toEqual([0.1, 10, 0.2, 10, 0.2001, 10.5]);
  });
});

describe('addStroke', () => {
  it('rounds for storage', () => {
    const [stroke] = addStroke([], line('a', [0.123456, 10.04, 0.5, 20.06]), W);
    expect(stroke?.points).toEqual([0.1235, 10, 0.5, 20.1]);
  });

  it('beyond the cap, the oldest strokes go first', () => {
    const big = Array.from({ length: MAX_POINTS }, (_, i) => [i / MAX_POINTS, i * 3]).flat();
    const first = addStroke([], line('old', big), W);
    const next = addStroke(first, line('new', [0.1, 1, 0.9, 1]), W);
    expect(next.map((stroke) => stroke.id)).toEqual(['new']);
  });
});

describe('erasing', () => {
  const a = line('a', [0.1, 100, 0.3, 100]); // a horizontal line from x=100 px to 300 px at y=100
  const b = line('b', [0.1, 300, 0.3, 300]);

  it('removes a whole stroke the eraser touches, and only that one', () => {
    expect(eraseAt([a, b], 0.2, 105, W).map((stroke) => stroke.id)).toEqual(['b']);
  });

  it('misses a stroke that is out of reach', () => {
    expect(eraseAt([a, b], 0.2, 200, W)).toHaveLength(2);
  });

  it('a highlighter is easier to hit, being wider', () => {
    const wide = line('h', [0.1, 100, 0.3, 100], 'highlighter');
    expect(strokeHit(a, 0.2, 116, W, 10)).toBe(false);
    expect(strokeHit(wide, 0.2, 116, W, 10)).toBe(true);
  });

  it('a dot can be erased', () => {
    expect(eraseAt([line('dot', [0.5, 50])], 0.5, 52, W)).toEqual([]);
  });
});

describe('drawing it', () => {
  it('smooths through midpoints and ends where the pen lifted', () => {
    expect(strokePath([0, 0, 0.1, 0, 0.1, 100], W)).toBe('M0 0Q100 0 100 50L100 100');
  });

  it('a dot still draws', () => {
    expect(strokePath([0.5, 50], W)).toBe('M500 50l0.01 0');
  });

  it('the layer is as tall as its lowest stroke', () => {
    expect(drawingBottom([line('a', [0, 10, 0.5, 900]), line('b', [0, 40])])).toBe(900);
  });
});
