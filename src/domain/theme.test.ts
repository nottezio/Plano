import { describe, expect, it } from 'vitest';

import { isTheme, resolveTheme, THEMES } from './theme';

describe('resolveTheme', () => {
  it('light and dark are what they say, whatever the device prefers', () => {
    expect(resolveTheme('light', true)).toEqual({ dark: false, senja: false });
    expect(resolveTheme('dark', false)).toEqual({ dark: true, senja: false });
  });

  it('sistem follows the device', () => {
    expect(resolveTheme('system', true)).toEqual({ dark: true, senja: false });
    expect(resolveTheme('system', false)).toEqual({ dark: false, senja: false });
  });

  it('senja is a dark-family theme in both device schemes, so dark: utilities apply', () => {
    expect(resolveTheme('senja', false)).toEqual({ dark: true, senja: true });
    expect(resolveTheme('senja', true)).toEqual({ dark: true, senja: true });
  });
});

describe('themes', () => {
  it('knows its ids and rejects anything else', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['system', 'light', 'dark', 'senja']);
    expect(isTheme('senja')).toBe(true);
    expect(isTheme('sepia')).toBe(false);
    expect(isTheme(null)).toBe(false);
  });
});
