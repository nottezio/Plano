import { describe, expect, it } from 'vitest';

import { stripEdges, wheelShift } from './ScrollStrip';

describe('stripEdges', () => {
  it('says which side has hidden content', () => {
    expect(stripEdges(0, 300, 300)).toEqual({ left: false, right: false });
    expect(stripEdges(0, 300, 900)).toEqual({ left: false, right: true });
    expect(stripEdges(300, 300, 900)).toEqual({ left: true, right: true });
    expect(stripEdges(600, 300, 900)).toEqual({ left: true, right: false });
  });

  it('ignores sub-pixel leftovers from fractional layout', () => {
    expect(stripEdges(0.5, 300, 300.6)).toEqual({ left: false, right: false });
  });
});

describe('wheelShift', () => {
  const both = { left: true, right: true };

  it('turns a vertical wheel into sideways movement while the row can move', () => {
    expect(wheelShift(0, 100, both)).toBe(100);
    expect(wheelShift(0, -100, both)).toBe(-100);
  });

  it('hands the wheel back to the page at either end', () => {
    expect(wheelShift(0, 100, { left: true, right: false })).toBe(0);
    expect(wheelShift(0, -100, { left: false, right: true })).toBe(0);
    expect(wheelShift(0, 100, { left: false, right: false })).toBe(0);
  });

  it('leaves a sideways trackpad swipe to the browser', () => {
    expect(wheelShift(80, 10, both)).toBe(0);
  });
});
