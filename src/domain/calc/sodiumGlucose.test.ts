import { describe, expect, it } from 'vitest';

import { correctSodium, formatSodiumCorrection } from './sodiumGlucose';

describe('correctSodium', () => {
  it('adds nothing at the reference glucose', () => {
    expect(correctSodium(130, 100)).toMatchObject({ katz: 130, hillier: 130 });
  });

  it('applies the two published factors per 100 mg/dL above it', () => {
    // Glucose 600 is 500 above reference: Katz +8.0, Hillier +12.0.
    expect(correctSodium(125, 600)).toMatchObject({ katz: 133, hillier: 137 });
  });

  it('does NOT correct downward below the reference glucose', () => {
    // The dilution being corrected for is caused by excess glucose. At 70
    // there is no excess, and a linear formula would otherwise return a
    // sodium lower than the one the lab measured.
    expect(correctSodium(130, 70)).toMatchObject({ katz: 130, hillier: 130 });
  });

  it('flags the point where the two factors stop agreeing', () => {
    // At glucose 600 they are 4 mmol/L apart — the difference between calling
    // the same sample hyponatraemic and calling it normal.
    expect(correctSodium(125, 600)?.factorsDiverge).toBe(true);
    expect(correctSodium(125, 150)?.factorsDiverge).toBe(false);
  });

  it('refuses nonsense rather than returning a number', () => {
    expect(correctSodium(0, 300)).toBeNull();
    expect(correctSodium(130, -1)).toBeNull();
    expect(correctSodium(Number.NaN, 300)).toBeNull();
  });
});

describe('formatSodiumCorrection', () => {
  it('names both factors in the pasted line', () => {
    // A corrected sodium with no factor beside it is a number nobody can
    // check, and the two disagree.
    const result = correctSodium(125, 600)!;
    const line = formatSodiumCorrection(125, 600, result);
    expect(line).toContain('Katz 1.6');
    expect(line).toContain('Hillier 2.4');
    expect(line).toContain('GDS 600');
  });
});
