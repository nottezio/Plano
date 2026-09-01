import { describe, expect, it } from 'vitest';

import {
  calculateOsmolality,
  calculatePotassiumDeficit,
  calculateSodiumCorrection,
} from './sodium';

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

describe('calculatePotassiumDeficit', () => {
  /**
   * REWRITTEN with the calculator, 2026-08-31.
   *
   * The old block pinned `(target − K) × BB × 0.4` plus a day's maintenance,
   * presented as the amount to give. That is a total-body deficit with an
   * unrelated daily requirement added to it — neither is an IV dose, and the
   * sum is larger than either.
   *
   * These pin the dose-response rule IV correction actually runs on:
   * ~10 mEq raises serum potassium by ~0.1 mmol/L.
   */
  it('gives ~10 mEq for each 0.1 mmol/L to be made up', () => {
    // 3.0 -> 3.5 is 0.5 mmol/L, so about 50 mEq.
    const result = calculatePotassiumDeficit({ current: 3.0, target: 3.5, weightKg: 70 });
    expect(result?.deficitMeq).toBe(50);
  });

  it('scales with the gap, not with body weight', () => {
    // The published rule is not weight-based. Two patients with the same
    // deficit get the same starting dose.
    const light = calculatePotassiumDeficit({ current: 3.0, target: 4.0, weightKg: 45 });
    const heavy = calculatePotassiumDeficit({ current: 3.0, target: 4.0, weightKg: 95 });
    expect(light?.deficitMeq).toBe(100);
    expect(heavy?.deficitMeq).toBe(100);
  });

  it('never adds maintenance to the correction dose', () => {
    // Adding it inflated the order by roughly a whole day's intake — 78 mEq
    // for a 78 kg patient — and was the reported bug.
    const result = calculatePotassiumDeficit({ current: 3.0, target: 3.5, weightKg: 78 });
    expect(result?.totalMeq).toBe(result?.deficitMeq);
    expect(result?.maintenanceMeq).toBe(78);
    expect(result?.totalMeq).not.toBe((result?.deficitMeq ?? 0) + 78);
  });

  it('rounds down to orderable units', () => {
    // KCl is ordered in 10 and 20 mEq units; rounding up would order more than
    // the estimate supports.
    const result = calculatePotassiumDeficit({ current: 3.15, target: 3.5, weightKg: 70 });
    expect(result?.deficitMeq).toBe(30);
  });

  it('caps at the 200 mEq daily ceiling and says so', () => {
    // Above that needs continuous ECG and central access, which the
    // calculator cannot see.
    const result = calculatePotassiumDeficit({ current: 1.8, target: 4.0, weightKg: 70 });
    expect(result?.deficitMeq).toBe(200);
    expect(result?.cappedAtDailyMax).toBe(true);
  });

  it('raises the rate ceiling only for severe hypokalaemia', () => {
    expect(
      calculatePotassiumDeficit({ current: 3.2, target: 4.0, weightKg: 70 })?.maxRatePerHour,
    ).toBe(10);
    expect(
      calculatePotassiumDeficit({ current: 2.2, target: 4.0, weightKg: 70 })?.maxRatePerHour,
    ).toBe(20);
  });

  it('converts to grams of KCl at 13.4 mmol per gram', () => {
    const result = calculatePotassiumDeficit({ current: 3.0, target: 3.5, weightKg: 70 });
    expect(result?.kclGrams).toBeCloseTo(3.7, 1);
  });

  it('refuses without a weight', () => {
    // Not because the dose needs it, but because a card that calculates for a
    // patient nobody weighed invites the rest of it to be trusted too.
    expect(calculatePotassiumDeficit({ current: 3.0, target: 3.5, weightKg: 0 })).toBeNull();
  });

  it('refuses when potassium is already at target', () => {
    expect(calculatePotassiumDeficit({ current: 4.0, target: 3.5, weightKg: 70 })).toBeNull();
  });

  it('shows its working, and says to recheck', () => {
    const result = calculatePotassiumDeficit({ current: 3.0, target: 3.5, weightKg: 70 });
    expect(result?.line).toContain('50 mEq KCl');
    expect(result?.line).toContain('10 mEq ~ 0.1 mmol/L');
    expect(result?.line).toContain('Cek ulang K 1-2 jam');
  });
});
