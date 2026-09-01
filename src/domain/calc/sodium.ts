/**
 * Plasma osmolality.
 *
 * Sodium and potassium correction USED TO live in this file. Both were wrong
 * in turn — the first pass conflated a total-body potassium deficit with an
 * IV dose, and the rewrite that fixed it built a new formula from web
 * references rather than from a source Avicenna could check against RSWS's
 * own protocol. Removed rather than corrected a third time: Avicenna's own
 * ElektroCalc (linked from the calculator page) is the source of truth for
 * both, and a dosing correction is the wrong kind of arithmetic to have
 * Claude own on this app's behalf.
 *
 * Osmolality stays. It is a single closed-form calculation with no dosing
 * decision riding on it, which is the case for keeping it here: the app
 * cannot show its working, and this can.
 *
 * Returns `null` on input it cannot use rather than a number computed from a
 * default.
 */

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export interface OsmolalityInput {
  /** Sodium, mmol/L. */
  sodium: number;
  /** Glucose, mg/dL. */
  glucose: number;
  /** BUN or ureum, mg/dL. */
  bun: number;
}

export interface OsmolalityResult {
  value: number;
  band: 'low' | 'normal' | 'high';
  line: string;
}

/**
 * 2·Na + glucose/18 + BUN/2.8.
 *
 * The divisors convert mg/dL to mmol/L for each solute; they are not fudge
 * factors, which is why glucose and BUN must be entered in mg/dL and sodium in
 * mmol/L. Mixing the units is the mistake this is most likely to hide, so the
 * fields say which unit they want.
 */
export function calculateOsmolality(input: OsmolalityInput): OsmolalityResult | null {
  const { sodium, glucose, bun } = input;

  if (!(sodium > 0) || !(glucose >= 0) || !(bun >= 0)) return null;

  const value = round(2 * sodium + glucose / 18 + bun / 2.8, 1);

  return {
    value,
    band: value < 275 ? 'low' : value > 295 ? 'high' : 'normal',
    line: `Osmolalitas = 2(${sodium}) + ${glucose}/18 + ${bun}/2.8 = ${value} mOsm/kg`,
  };
}

export const OSMOLALITY_BANDS: Record<OsmolalityResult['band'], string> = {
  low: 'Hipoosmolal (<275)',
  normal: 'Normal (275–295)',
  high: 'Hiperosmolal (>295)',
};

