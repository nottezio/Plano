import { describe, expect, it } from 'vitest';
import { SLIDE_H, SLIDE_W } from './geometry';
import { snapMove, snapResize } from './snap';

const T = 50_000; // snap distance in EMU
const box = { x: 3_000_000, y: 2_000_000, w: 2_000_000, h: 1_000_000 };

describe('snapMove', () => {
  it("snaps the box's centre to the slide centre and says which line", () => {
    const r = snapMove({ ...box, x: SLIDE_W / 2 - 1_000_000 + 30_000 }, [], SLIDE_H, T);
    expect(r.rect.x).toBe(SLIDE_W / 2 - 1_000_000);
    expect(r.guides.x).toEqual([SLIDE_W / 2]);
  });

  it('snaps an edge to the edge of another object', () => {
    const other = { x: 1_000_000, y: 4_000_000, w: 1_500_000, h: 800_000 };
    const r = snapMove({ ...box, x: 2_500_000 + 20_000, y: 4_000_000 - 1_000_000 - 20_000 }, [other], SLIDE_H, T);
    expect(r.rect.x).toBe(2_500_000); // left edge on the other box's right edge
    expect(r.rect.y).toBe(3_000_000); // bottom edge on the other box's top edge
    expect(r.guides).toEqual({ x: [2_500_000], y: [4_000_000] });
  });

  it('leaves the box alone beyond the snap distance', () => {
    const r = snapMove({ ...box, x: SLIDE_W / 2 - 1_000_000 + 200_000 }, [], SLIDE_H, T);
    expect(r.rect.x).toBe(SLIDE_W / 2 - 1_000_000 + 200_000);
    expect(r.guides.x).toEqual([]);
  });

  it('snaps to the slide edges', () => {
    expect(snapMove({ ...box, x: 20_000 }, [], SLIDE_H, T).rect.x).toBe(0);
    expect(snapMove({ ...box, y: SLIDE_H - 1_000_000 - 20_000 }, [], SLIDE_H, T).rect.y).toBe(SLIDE_H - 1_000_000);
  });

  it('takes the closest of several lines', () => {
    const near = { x: 3_040_000, y: 0, w: 100_000, h: 100_000 };
    expect(snapMove({ ...box, x: 3_030_000 }, [near], SLIDE_H, T).rect.x).toBe(3_040_000);
  });
});

describe('snapResize', () => {
  it('free: the right and bottom edges snap to the slide edges independently', () => {
    const r = snapResize({ ...box, w: SLIDE_W - box.x - 20_000, h: SLIDE_H - box.y - 30_000 }, [], SLIDE_H, T, false);
    expect(r.rect).toMatchObject({ w: SLIDE_W - box.x, h: SLIDE_H - box.y });
    expect(r.guides).toEqual({ x: [SLIDE_W], y: [SLIDE_H] });
  });

  it('aspect: snaps the right edge and keeps the proportions', () => {
    const w = SLIDE_W - 3_000_000 - 20_000;
    const r = snapResize({ x: 3_000_000, y: 2_000_000, w, h: Math.round(0.5 * w) }, [], SLIDE_H, T, true);
    expect(r.rect.w).toBe(SLIDE_W - 3_000_000);
    expect(r.rect.h).toBe(Math.round(0.5 * r.rect.w));
  });

  it('leaves the size alone when nothing is near', () => {
    const r = snapResize(box, [], SLIDE_H, T, false);
    expect(r.rect).toEqual(box);
    expect(r.guides).toEqual({ x: [], y: [] });
  });
});
