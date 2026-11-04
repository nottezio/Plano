import { describe, expect, it } from 'vitest';

import { CANVAS_BACKGROUNDS, DEFAULT_CANVAS_BACKGROUND, canvasBackgroundOf } from './boardBackground';

describe('canvas backgrounds', () => {
  it('lists each background once, with the default and the plain page among them', () => {
    const ids = CANVAS_BACKGROUNDS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_CANVAS_BACKGROUND);
    expect(ids).toContain('polos');
    expect(ids).toHaveLength(6);
  });

  it('reads a missing or unknown value as the default, so an old profile or a newer build never breaks the board', () => {
    expect(canvasBackgroundOf(undefined)).toBe(DEFAULT_CANVAS_BACKGROUND);
    expect(canvasBackgroundOf('hologram')).toBe(DEFAULT_CANVAS_BACKGROUND);
    expect(canvasBackgroundOf(null)).toBe(DEFAULT_CANVAS_BACKGROUND);
    expect(canvasBackgroundOf('gabus')).toBe('gabus');
  });
});
