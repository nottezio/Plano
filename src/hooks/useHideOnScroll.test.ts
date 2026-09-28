import { describe, expect, it } from 'vitest';

import { nextHidden } from './useHideOnScroll';

describe('nextHidden', () => {
  const HEADER = 100;

  it('hides on a real scroll down, past the header', () => {
    expect(nextHidden(false, 400, 380, HEADER)).toBe(true);
  });

  it('shows on any real scroll up', () => {
    expect(nextHidden(true, 380, 400, HEADER)).toBe(false);
  });

  it('ignores finger jitter', () => {
    expect(nextHidden(true, 403, 400, HEADER)).toBe(true);
    expect(nextHidden(false, 397, 400, HEADER)).toBe(false);
  });

  it('is always shown near the top', () => {
    expect(nextHidden(true, 60, 20, HEADER)).toBe(false);
  });
});
