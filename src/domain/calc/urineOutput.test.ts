import { describe, expect, it } from 'vitest';

import { calculateUrineOutput } from './urineOutput';

describe('calculateUrineOutput', () => {
  it('reproduces a line from a real handover', () => {
    const result = calculateUrineOutput({ volumeMl: 1100, hours: 24, weightKg: 55 });
    expect(result?.rate).toBe(0.83);
    expect(result?.line).toBe('Urine output 1100 cc/24 jam/55kg: 0.83 cc/kgbb/jam');
  });

  it('reproduces a second one, from a shorter collection', () => {
    const result = calculateUrineOutput({ volumeMl: 500, hours: 6, weightKg: 72 });
    expect(result?.rate).toBe(1.16);
    expect(result?.perDayMl).toBe(2000);
  });

  it('projects a 24-hour volume from a partial collection', () => {
    expect(calculateUrineOutput({ volumeMl: 250, hours: 6, weightKg: 60 })?.perDayMl).toBe(1000);
  });

  it('bands the rate for orientation', () => {
    expect(calculateUrineOutput({ volumeMl: 240, hours: 24, weightKg: 60 })?.band).toBe('oliguria');
    expect(calculateUrineOutput({ volumeMl: 1000, hours: 24, weightKg: 60 })?.band).toBe('low');
    expect(calculateUrineOutput({ volumeMl: 2000, hours: 24, weightKg: 60 })?.band).toBe('normal');
    expect(calculateUrineOutput({ volumeMl: 6000, hours: 24, weightKg: 60 })?.band).toBe('high');
  });

  it('returns nothing rather than Infinity when hours is zero', () => {
    expect(calculateUrineOutput({ volumeMl: 1100, hours: 0, weightKg: 55 })).toBeNull();
  });

  it('returns nothing rather than a guess when weight is missing', () => {
    // A rate from an assumed weight looks exactly like one from a real weight.
    expect(calculateUrineOutput({ volumeMl: 1100, hours: 24, weightKg: 0 })).toBeNull();
  });

  it('rejects negative and non-numeric input', () => {
    expect(calculateUrineOutput({ volumeMl: -100, hours: 24, weightKg: 55 })).toBeNull();
    expect(calculateUrineOutput({ volumeMl: Number.NaN, hours: 24, weightKg: 55 })).toBeNull();
  });

  it('accepts a zero volume, which is a finding rather than an error', () => {
    const result = calculateUrineOutput({ volumeMl: 0, hours: 12, weightKg: 60 });
    expect(result?.rate).toBe(0);
    expect(result?.band).toBe('oliguria');
  });

  it('handles a fractional weight without printing noise', () => {
    expect(calculateUrineOutput({ volumeMl: 1000, hours: 24, weightKg: 62.5 })?.line).toContain(
      '62.5kg',
    );
  });
});
