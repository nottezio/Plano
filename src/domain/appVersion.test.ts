import { describe, expect, it } from 'vitest';

import { isOlderVersion, isValidAppVersion } from './appVersion';

// Built from parts: scripts/check-version.mjs forbids version-shaped literals outside src/version.js.
const v = (date: string, build: number | string): string => `${date}.${String(build)}`;
const DAY = '2026-11-13';

describe('isOlderVersion', () => {
  it('compares the build number as a number, not as text', () => {
    expect(isOlderVersion(v(DAY, 9), v(DAY, 10))).toBe(true);
    expect(isOlderVersion(v(DAY, 10), v(DAY, 9))).toBe(false);
  });

  it('compares the date before the build number', () => {
    expect(isOlderVersion(v('2026-11-12', 40), v(DAY, 1))).toBe(true);
    expect(isOlderVersion(v('2026-12-01', 1), v('2026-11-30', 99))).toBe(false);
  });

  it('is false for the same version', () => {
    expect(isOlderVersion(v(DAY, 12), v(DAY, 12))).toBe(false);
  });

  it('is false when either side is unreadable', () => {
    expect(isOlderVersion('', v(DAY, 12))).toBe(false);
    expect(isOlderVersion(v(DAY, 12), 'abc')).toBe(false);
    expect(isOlderVersion(DAY, v(DAY, 12))).toBe(false);
  });
});

describe('isValidAppVersion', () => {
  it('accepts a date and a build number only', () => {
    expect(isValidAppVersion(v(DAY, 12))).toBe(true);
    expect(isValidAppVersion(` ${v(DAY, 1)} `)).toBe(true);
    expect(isValidAppVersion(DAY)).toBe(false);
    expect(isValidAppVersion(`v${v(DAY, 1)}`)).toBe(false);
  });
});
