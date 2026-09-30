/**
 * Plasma osmolality (calculated), total and effective.
 *
 * Sodium and potassium REPLACEMENT used to live in this file. Both were wrong
 * in turn and were removed: Avicenna's own ElektroCalc (linked from the
 * calculator page) is the source of truth for any dose. Osmolality stays: it
 * is a closed-form calculation with no dosing decision riding on it, and it
 * shows its working.
 *
 * UREUM IS NOT BUN (fixed 2026-09-30)
 *
 * The formula used to be `2·Na + glucose/18 + BUN/2.8`, with the field
 * labelled BUN and this file documenting the input as "BUN or ureum". Indonesian
 * labs (SIMGOS) report UREUM, the whole urea molecule (60 g/mol), not blood
 * urea NITROGEN (the two nitrogens, 28 g/mol). The divisor 2.8 converts BUN
 * mg/dL to mmol/L; applied to ureum it overstates the urea term 2.14×
 * (60/28). Ureum 60 mg/dL is 10 mmol/L, but the old card added 21.4; at
 * ureum 180 (cardiorenal) it added 64 instead of 30. That turned a hypotonic
 * sample into a "normal" one on screen.
 *
 * So the urea term takes its KIND: ureum ÷ 6.0, BUN ÷ 2.8. Both divisors are
 * unit conversions (molar mass ÷ 10), not fudge factors.
 *
 * EFFECTIVE OSMOLALITY (TONICITY)
 *
 * Urea crosses cell membranes freely, so it does not move water. What decides
 * whether a hyponatraemia is hypotonic — the question to answer before any
 * sodium correction — is `2·Na + glucose/18`, without urea. Both are returned;
 * the effective value is the one to read for hyponatraemia.
 *
 * NO BUILT-IN BANDS
 *
 * The card used to label results against 275–295 compiled into the app. Plano
 * carries no clinical reference ranges (a range belongs to the lab and the
 * reader), so a band is shown only when the user has entered one in
 * Pengaturan → Rentang rujukan lab.
 *
 * Returns `null` on input it cannot use rather than a number computed from a
 * default.
 */

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export type UreaKind = 'ureum' | 'bun';

/** mg/dL → mmol/L: molar mass ÷ 10. Urea 60.06 g/mol; urea nitrogen 28.01. */
export const UREA_DIVISOR: Record<UreaKind, number> = { ureum: 6, bun: 2.8 };
/** Glucose 180.16 g/mol. */
export const GLUCOSE_DIVISOR = 18;

export const UREA_LABEL: Record<UreaKind, string> = { ureum: 'Ureum', bun: 'BUN' };

export interface OsmolalityInput {
  /** Sodium, mmol/L. */
  sodium: number;
  /** Glucose, mg/dL. */
  glucose: number;
  /** Ureum or BUN, mg/dL — which one is `ureaKind`. */
  urea: number;
  ureaKind: UreaKind;
}

export interface OsmolalityResult {
  /** 2·Na + glucose/18 + urea term. */
  total: number;
  /** 2·Na + glucose/18: tonicity, the value for classifying hyponatraemia. */
  effective: number;
  /** The urea term in mmol/L, to show how much of `total` is ineffective. */
  ureaTerm: number;
  line: string;
}

export function calculateOsmolality(input: OsmolalityInput): OsmolalityResult | null {
  const { sodium, glucose, urea, ureaKind } = input;
  if (!(sodium > 0) || !(glucose >= 0) || !(urea >= 0)) return null;
  if (![sodium, glucose, urea].every(Number.isFinite)) return null;

  const divisor = UREA_DIVISOR[ureaKind];
  const glucoseTerm = glucose / GLUCOSE_DIVISOR;
  const ureaTerm = urea / divisor;
  const effective = round(2 * sodium + glucoseTerm, 1);
  const total = round(2 * sodium + glucoseTerm + ureaTerm, 1);

  return {
    total,
    effective,
    ureaTerm: round(ureaTerm, 1),
    line:
      `Osmolalitas = 2(${sodium}) + ${glucose}/${GLUCOSE_DIVISOR} + ${UREA_LABEL[ureaKind]} ${urea}/${divisor} = ${total} mOsm/kg` +
      ` · efektif (tanpa urea) ${effective} mOsm/kg`,
  };
}

/** Below / within / above the user's own range, or null when none is set. */
export function bandFor(
  value: number,
  range: { low: number; high: number } | undefined,
): 'low' | 'normal' | 'high' | null {
  if (!range) return null;
  if (value < range.low) return 'low';
  if (value > range.high) return 'high';
  return 'normal';
}

export const OSMOLALITY_BANDS: Record<'low' | 'normal' | 'high', string> = {
  low: 'Hipoosmolal',
  normal: 'Dalam rentang',
  high: 'Hiperosmolal',
};
