import { describe, expect, it } from 'vitest';

import { DPJPS, TRIO_DPJP_IDS, isTrioDpjp } from './dpjp';

describe('trio DPJPs', () => {
  it('is AFM, AFG and ZD', () => {
    expect(TRIO_DPJP_IDS).toEqual(['afm', 'afg', 'zd']);
  });

  it('names ids that actually exist in the registry', () => {
    // A typo here would silently switch the reminder off for that consultant,
    // and nothing else would fail.
    for (const id of TRIO_DPJP_IDS) {
      expect(DPJPS.some((dpjp) => dpjp.id === id)).toBe(true);
    }
  });

  it('does not match a consultant outside the trio', () => {
    expect(isTrioDpjp('mz')).toBe(false);
  });

  it('is false when the patient has no DPJP', () => {
    // A patient with no consultant recorded must not get a reminder that
    // implies one.
    expect(isTrioDpjp(null)).toBe(false);
    expect(isTrioDpjp(undefined)).toBe(false);
  });
});
