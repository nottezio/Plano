import { describe, expect, it } from 'vitest';

import { CARD_STYLES, DENSITIES, TEXT_SIZES, applyAppearance, cardStyleOf, densityOf, textSizeOf } from './appearance';

describe('appearance settings', () => {
  it('lists three choices each, the default among them', () => {
    expect(DENSITIES.map((e) => e.id)).toEqual(['kompak', 'normal', 'longgar']);
    expect(TEXT_SIZES.map((e) => e.id)).toEqual(['kecil', 'normal', 'besar']);
    expect(CARD_STYLES.map((e) => e.id)).toEqual(['pastel', 'netral', 'garis']);
  });

  it('reads a missing or unknown value as the default, so an old profile or newer build never breaks the screen', () => {
    expect(densityOf(undefined)).toBe('normal');
    expect(densityOf('padat')).toBe('normal');
    expect(textSizeOf(null)).toBe('normal');
    expect(textSizeOf('raksasa')).toBe('normal');
    expect(cardStyleOf(undefined)).toBe('pastel');
    expect(cardStyleOf('neon')).toBe('pastel');
    expect(densityOf('kompak')).toBe('kompak');
    expect(textSizeOf('besar')).toBe('besar');
    expect(cardStyleOf('garis')).toBe('garis');
  });

  it('writes the three attributes, falling back per field', () => {
    const attrs = new Map<string, string>();
    applyAppearance({ density: 'longgar', textSize: 'bogus' }, { setAttribute: (k, v) => void attrs.set(k, v) });
    expect(attrs.get('data-density')).toBe('longgar');
    expect(attrs.get('data-text-size')).toBe('normal');
    expect(attrs.get('data-card-style')).toBe('pastel');
  });
});
