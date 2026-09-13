/**
 * Corrected sodium in hyperglycaemia.
 *
 * WHY THIS ONE IS HERE WHEN THE OTHER SODIUM CARDS WERE REMOVED
 *
 * The sodium and potassium REPLACEMENT calculators were taken out of this app
 * (see `CalculatorPage`) because they produced a dose, and a dose has to match
 * a protocol that only the ward owns. This is a different kind of number: it
 * says what the measured sodium would read if the glucose were normal. It
 * prescribes nothing, and the two published factors are quoted openly so the
 * reader can see which one they are looking at.
 *
 * WHY BOTH FACTORS, NOT ONE
 *
 * They disagree, and the disagreement is the clinically interesting part.
 * Katz's 1.6 comes from a 1973 theoretical derivation; Hillier's 2.4 comes
 * from a 1999 experimental study and fits better once glucose is high. Picking
 * one and hiding the other would present a contested number as a settled one —
 * at glucose 600 they differ by about 6 mmol/L, which is the difference
 * between "hyponatraemia" and "normal" on the same blood sample.
 *
 * Units are mg/dL for glucose, which is what Indonesian labs report (`GDS 147`
 * throughout the corpus). No mmol/L input, because offering both is offering
 * the chance to enter one in the other's box.
 */

/** Katz MA. N Engl J Med 1973;289:843-4. */
export const KATZ_FACTOR = 1.6;
/** Hillier TA, Abbott RD, Barrett EJ. Am J Med 1999;106:399-403. */
export const HILLIER_FACTOR = 2.4;

/** The glucose these corrections are measured FROM, in mg/dL. */
export const REFERENCE_GLUCOSE = 100;

export interface SodiumCorrection {
  katz: number;
  hillier: number;
  /** True once the two factors are far enough apart to matter at the bedside. */
  factorsDiverge: boolean;
}

export function correctSodium(
  measuredSodium: number,
  glucoseMgDl: number,
): SodiumCorrection | null {
  if (!Number.isFinite(measuredSodium) || !Number.isFinite(glucoseMgDl)) return null;
  if (measuredSodium <= 0 || glucoseMgDl <= 0) return null;

  /*
    Below the reference glucose the correction is NOT applied downward.

    The formula is linear and will happily return a sodium lower than the one
    measured for a glucose of 70 — which is meaningless: the dilution this
    corrects for is caused by the excess glucose, and there is no excess. A
    normoglycaemic sample needs no correction, so it gets none.
  */
  const excess = Math.max(0, glucoseMgDl - REFERENCE_GLUCOSE);

  const katz = measuredSodium + (KATZ_FACTOR * excess) / 100;
  const hillier = measuredSodium + (HILLIER_FACTOR * excess) / 100;

  return {
    katz: Math.round(katz * 10) / 10,
    hillier: Math.round(hillier * 10) / 10,
    // One whole mmol/L apart is where the two stop being the same answer
    // rounded differently — it happens around glucose 225.
    factorsDiverge: hillier - katz >= 1,
  };
}

/** The line to paste into a note. */
export function formatSodiumCorrection(
  measuredSodium: number,
  glucoseMgDl: number,
  result: SodiumCorrection,
): string {
  return [
    `Na terukur ${measuredSodium} mmol/L pada GDS ${glucoseMgDl} mg/dL`,
    `Na terkoreksi ${result.katz} (Katz 1.6) / ${result.hillier} (Hillier 2.4) mmol/L`,
  ].join('\n');
}
