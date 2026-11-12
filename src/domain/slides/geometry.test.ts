import { describe, expect, it } from 'vitest';
import { GEOMETRY, PALETTE_B, SLIDE_H, SLIDE_W, geometryFor, pct, slideHeight } from './geometry';

/** WCAG 2 contrast ratio; the repo's own helper lives in a script, not in src. */
function luminance(hex: string): number {
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe('slide geometry', () => {
  it('soap columns are 11 / 58.5 / 30.5 % and sum to the slide width', () => {
    const [a, b, c] = GEOMETRY.soapCols;
    expect(a + b + c).toBe(SLIDE_W);
    expect(Math.round((a / SLIDE_W) * 1000)).toBe(110);
    expect(Math.round((b / SLIDE_W) * 1000)).toBe(585);
  });

  it('one-photo frame matches the reference slide', () => {
    expect(GEOMETRY.photos.one[0]).toEqual(pct(21.3, 13.6, 57.4, 84.0));
  });

  it('layouts have 1, 2, 3, 4 and 1 frames', () => {
    expect(GEOMETRY.photos.one).toHaveLength(1);
    expect(GEOMETRY.photos.two).toHaveLength(2);
    expect(GEOMETRY.photos.three).toHaveLength(3);
    expect(GEOMETRY.photos.four).toHaveLength(4);
    expect(GEOMETRY.photos.photoText).toHaveLength(1);
  });

  it('a tall deck is 4:3: same width, taller slide, the SOAP header row keeps its height', () => {
    expect(slideHeight(false)).toBe(SLIDE_H);
    expect(slideHeight(true)).toBe(9_144_000);
    const tall = geometryFor(true);
    expect(tall.textOnly.h).toBeGreaterThan(GEOMETRY.textOnly.h);
    expect(tall.soapHeaderH).toBe(GEOMETRY.soapHeaderH);
    expect(tall.soapCols).toEqual(GEOMETRY.soapCols);
    expect(geometryFor(false)).toBe(GEOMETRY);
  });

  it('palette text pairs reach 4.5:1', () => {
    expect(contrastRatio('FFFFFF', PALETTE_B.head)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(PALETTE_B.sec, PALETTE_B.body)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(PALETTE_B.ink, PALETTE_B.idCol)).toBeGreaterThanOrEqual(4.5);
  });
});
