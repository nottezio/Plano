import { describe, expect, it } from 'vitest';

import {
  COLOR_SENTINEL,
  isBareAfterColorRemoved,
  isSentinelColor,
  parseColor,
} from './noteColor';

/**
 * "Biasa" in the note colour palette.
 *
 * It used to pass the string `'inherit'` to `execCommand('foreColor')`, which
 * is not a colour — the browser rejects it, the button did nothing, and red
 * text had no way back. Its swatch was `transparent` as well, so the control
 * that should have fixed it was itself invisible.
 *
 * These pin the two decisions the fix rests on. The DOM walk around them is
 * deliberately thin, so that the parts worth being sure about need no browser
 * to test — this project has no jsdom, and adding one for six assertions would
 * cost more than it settles.
 */
describe('isSentinelColor', () => {
  it('matches regardless of spacing and case', () => {
    // `style.color` returns `rgb(1,2,3)`; a `color` attribute returns whatever
    // was written. A straight equality check matches one and misses the other.
    expect(isSentinelColor(COLOR_SENTINEL)).toBe(true);
    expect(isSentinelColor('rgb(1,2,3)')).toBe(true);
    expect(isSentinelColor('RGB(1, 2, 3)')).toBe(true);
  });

  it('does not match a real palette colour', () => {
    // Only the run just painted is reset; the rest of the note keeps its
    // colours.
    expect(isSentinelColor('rgb(220, 38, 38)')).toBe(false);
    expect(isSentinelColor('#dc2626')).toBe(false);
    expect(isSentinelColor(null)).toBe(false);
  });
});

describe('isBareAfterColorRemoved', () => {
  it('unwraps an element that only ever carried the colour', () => {
    expect(isBareAfterColorRemoved([])).toBe(true);
    expect(isBareAfterColorRemoved(['color'])).toBe(true);
    expect(isBareAfterColorRemoved(['style'])).toBe(true);
  });

  it('keeps an element still doing another job', () => {
    // Dropping it would silently lose formatting nobody asked to lose.
    expect(isBareAfterColorRemoved(['size'])).toBe(false);
    expect(isBareAfterColorRemoved(['color', 'size'])).toBe(false);
    expect(isBareAfterColorRemoved(['class'])).toBe(false);
  });
});

/**
 * Restoring the colour turned the text BLACK, 2026-08-31.
 *
 * The sentinel is written `rgb(1, 2, 3)` and Chrome stores it on the element
 * as the hex `#010203`. The first matcher compared strings with whitespace and
 * case removed, so it recognised neither form, stripped nothing, and left the
 * near-black sentinel painted on the text.
 */
describe('parseColor', () => {
  it('reads the notations a browser actually stores', () => {
    expect(parseColor('rgb(1, 2, 3)')).toEqual([1, 2, 3]);
    expect(parseColor('rgb(1,2,3)')).toEqual([1, 2, 3]);
    expect(parseColor('#010203')).toEqual([1, 2, 3]);
    expect(parseColor('#ABC')).toEqual([170, 187, 204]);
    expect(parseColor('rgba(1, 2, 3, 0.5)')).toEqual([1, 2, 3]);
  });

  it('returns null for anything that is not a colour', () => {
    // `inherit` is what the broken version passed to `foreColor` in the first
    // place.
    expect(parseColor('inherit')).toBeNull();
    expect(parseColor('')).toBeNull();
    expect(parseColor(null)).toBeNull();
  });
});

describe('sentinel matching survives notation rewriting', () => {
  it('recognises the sentinel however the browser stored it', () => {
    expect(isSentinelColor('rgb(1, 2, 3)')).toBe(true);
    expect(isSentinelColor('rgb(1,2,3)')).toBe(true);
    // The form Chrome writes, and the one the first version missed.
    expect(isSentinelColor('#010203')).toBe(true);
    expect(isSentinelColor('#010203'.toUpperCase())).toBe(true);
  });

  it('still does not match a real palette colour', () => {
    expect(isSentinelColor('#dc2626')).toBe(false);
    expect(isSentinelColor('rgb(220, 38, 38)')).toBe(false);
    // Near miss: one channel out. A fuzzy comparison here would strip a colour
    // the user chose.
    expect(isSentinelColor('rgb(1, 2, 4)')).toBe(false);
  });
});
