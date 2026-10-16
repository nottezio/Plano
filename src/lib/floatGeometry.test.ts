import { describe, expect, it } from 'vitest';

import { clampGeometry, dragGeometry, readStoredGeometry } from './floatGeometry';

const view = { width: 1200, height: 800, top: 52 };
const min = { w: 320, h: 220 };

describe('floating window geometry (2026-10-17)', () => {
  it('keeps a box wholly on screen, under the tab strip, at least its minimum size', () => {
    expect(clampGeometry({ x: -50, y: 0, w: 100, h: 100 }, view, min)).toEqual({ x: 8, y: 52, w: 320, h: 220 });
    // Dragged off the bottom right: pulled back so the resize corner stays reachable.
    expect(clampGeometry({ x: 1100, y: 750, w: 400, h: 500 }, view, min)).toEqual({ x: 792, y: 572, w: 400, h: 220 });
  });

  it('moves by the header, resizes from the corner', () => {
    const g = { x: 100, y: 100, w: 400, h: 300 };
    expect(dragGeometry(g, 'move', 20, -10)).toEqual({ x: 120, y: 90, w: 400, h: 300 });
    expect(dragGeometry(g, 'resize', 20, -10)).toEqual({ x: 100, y: 100, w: 420, h: 290 });
  });

  it('reads a stored geometry defensively', () => {
    expect(readStoredGeometry(null)).toBeNull();
    expect(readStoredGeometry('{"x":1,"y":2,"w":3}')).toBeNull();
    expect(readStoredGeometry('{"x":1,"y":2,"w":3,"h":4}')).toEqual({ x: 1, y: 2, w: 3, h: 4 });
  });
});
