import { describe, expect, it } from 'vitest';

import { calculateOsmolality, calculateSodiumCorrection } from './sodium';

describe('calculateSodiumCorrection', () => {
  it('reproduces the worked example from the reference sheet', () => {
    // Na 110, target 140, male, 50 kg → 900 meq; at 0.5 meq/jam → 60 jam.
    const result = calculateSodiumCorrection({
      current: 110,
      target: 140,
      weightKg: 50,
      sex: 'L',
      ratePerHour: 0.5,
    });
    expect(result?.deficitMeq).toBe(900);
    expect(result?.hours).toBe(60);
  });

  it('uses 0.5 for women, as the sheet specifies', () => {
    const result = calculateSodiumCorrection({
      current: 110,
      target: 140,
      weightKg: 50,
      sex: 'P',
      ratePerHour: 0.5,
    });
    expect(result?.factor).toBe(0.5);
    expect(result?.deficitMeq).toBe(750);
  });

  it('halves the time at 1 meq/jam, for declining consciousness', () => {
    const result = calculateSodiumCorrection({
      current: 110,
      target: 140,
      weightKg: 50,
      sex: 'L',
      ratePerHour: 1,
    });
    expect(result?.hours).toBe(30);
  });

  it('converts the deficit to a volume of 3% NaCl', () => {
    // 1000 cc carries ~512 meq, so 900 meq is a little under 1800 cc.
    const result = calculateSodiumCorrection({
      current: 110,
      target: 140,
      weightKg: 50,
      sex: 'L',
      ratePerHour: 0.5,
    });
    expect(result?.volume3PercentMl).toBe(1758);
  });

  it('returns nothing when sodium is already at target', () => {
    // A negative deficit would print as a negative volume, which reads as an
    // instruction rather than as an error.
    expect(
      calculateSodiumCorrection({
        current: 145,
        target: 140,
        weightKg: 50,
        sex: 'L',
        ratePerHour: 0.5,
      }),
    ).toBeNull();
  });

  it('returns nothing without a weight', () => {
    expect(
      calculateSodiumCorrection({
        current: 110,
        target: 140,
        weightKg: 0,
        sex: 'L',
        ratePerHour: 0.5,
      }),
    ).toBeNull();
  });

  it('shows its working in the copyable line', () => {
    const line = calculateSodiumCorrection({
      current: 110,
      target: 140,
      weightKg: 50,
      sex: 'L',
      ratePerHour: 0.5,
    })?.line;
    expect(line).toContain('(140-110) x 0.6 x 50 = 900 meq');
    expect(line).toContain('60 jam');
  });
});

describe('calculateOsmolality', () => {
  it('applies the standard formula', () => {
    // 2(140) + 90/18 + 14/2.8 = 280 + 5 + 5 = 290
    expect(calculateOsmolality({ sodium: 140, glucose: 90, bun: 14 })?.value).toBe(290);
  });

  it('matches a hypoosmolal case from a real note', () => {
    const result = calculateOsmolality({ sodium: 126, glucose: 100, bun: 20 });
    expect(result?.value).toBe(264.7);
    expect(result?.band).toBe('low');
  });

  it('bands the result', () => {
    expect(calculateOsmolality({ sodium: 150, glucose: 200, bun: 40 })?.band).toBe('high');
    expect(calculateOsmolality({ sodium: 140, glucose: 90, bun: 14 })?.band).toBe('normal');
  });

  it('accepts zero glucose and BUN but not zero sodium', () => {
    expect(calculateOsmolality({ sodium: 140, glucose: 0, bun: 0 })?.value).toBe(280);
    expect(calculateOsmolality({ sodium: 0, glucose: 90, bun: 14 })).toBeNull();
  });

  it('shows its working', () => {
    expect(calculateOsmolality({ sodium: 140, glucose: 90, bun: 14 })?.line).toBe(
      'Osmolalitas = 2(140) + 90/18 + 14/2.8 = 290 mOsm/kg',
    );
  });
});
