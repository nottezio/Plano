import { describe, expect, it } from 'vitest';

import { MAX_ZOOM, clampZoom, pinchStart, pinchStep, readStoredZoom, zoomAbout } from './pinch';

describe('denah pinch zoom', () => {
  it('keeps the scale between fit and twice full size', () => {
    expect(clampZoom(0.1, 0.44)).toBe(0.44);
    expect(clampZoom(5, 0.44)).toBe(MAX_ZOOM);
    expect(clampZoom(1.3, 0.44)).toBe(1.3);
    expect(clampZoom(Number.NaN, 0.44)).toBe(0.44);
  });

  it('reads the stored zoom, including the old "0"/"1" values', () => {
    expect(readStoredZoom(null)).toBeNull();
    expect(readStoredZoom('0')).toBeNull();
    expect(readStoredZoom('1')).toBe(1);
    expect(readStoredZoom('1.35')).toBe(1.35);
    expect(readStoredZoom('9')).toBe(MAX_ZOOM);
    expect(readStoredZoom('abc')).toBeNull();
  });

  it('doubles the scale when the fingers spread to twice the distance', () => {
    const box = { left: 0, top: 100, scrollLeft: 0 };
    const start = pinchStart({ x: 150, y: 300 }, { x: 250, y: 300 }, box, 0.5);
    const step = pinchStep(start, { x: 100, y: 300 }, { x: 300, y: 300 }, box, 0.44);
    expect(step.scale).toBe(1);
  });

  it('keeps the plan point under the fingers in place', () => {
    const box = { left: 16, top: 120, scrollLeft: 40 };
    const a = { x: 150, y: 320 };
    const b = { x: 250, y: 360 };
    const start = pinchStart(a, b, box, 0.5);
    const step = pinchStep(start, { x: 100, y: 300 }, { x: 300, y: 380 }, box, 0.44);
    const midX = 200;
    const midY = 340;
    // Plan point → screen after the step: left + planX·scale − scrollLeft, top − scrollBy + planY·scale.
    expect(box.left + start.planX * step.scale - step.scrollLeft).toBeCloseTo(midX);
    expect(box.top - step.scrollBy + start.planY * step.scale).toBeCloseTo(midY);
  });

  it('zooms about a screen point so the plan point under it stays put', () => {
    const box = { left: 16, top: 120, scrollLeft: 40 };
    const point = { x: 200, y: 400 };
    const move = zoomAbout(0.5, 1, point, box);
    const planX = (point.x - box.left + box.scrollLeft) / 0.5;
    const planY = (point.y - box.top) / 0.5;
    expect(box.left + planX * 1 - move.scrollLeft).toBeCloseTo(point.x);
    expect(box.top - move.scrollBy + planY * 1).toBeCloseTo(point.y);
  });

  it('zooming out near the left edge never scrolls to a negative position', () => {
    expect(zoomAbout(1, 0.5, { x: 20, y: 50 }, { left: 0, top: 0, scrollLeft: 0 }).scrollLeft).toBe(0);
  });

  it('never scrolls the plan to a negative position', () => {
    const box = { left: 0, top: 0, scrollLeft: 0 };
    const start = pinchStart({ x: 10, y: 10 }, { x: 30, y: 10 }, box, 1);
    expect(pinchStep(start, { x: 15, y: 10 }, { x: 25, y: 10 }, box, 0.44).scrollLeft).toBe(0);
  });
});
