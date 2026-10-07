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
 * GUIDELINE CUT-OFFS, NOT A LAB RANGE (Avi, 2026-09-30)
 *
 * Plano carries no lab reference ranges. The exception, asked for by Avi, is a
 * short list of published CUT-OFFS, each shown with its source, because they
 * are decisions rather than a lab's property:
 *
 * - Effective < 275: hypotonic (Spasovski et al., Eur J Endocrinol 2014,
 *   hyponatraemia guideline; defined there on MEASURED osmolality, which the
 *   calculated effective value approximates).
 * - Effective > 300 or total > 320: the HHS osmolality criterion (Umpierrez et
 *   al., Diabetes Care 2024), meaningful with glucose >= 600 mg/dL. The 2009
 *   criterion was effective > 320; 2024 lowered it.
 * - Total 275–295: the usual normal range. A range the user enters in
 *   Pengaturan → Rentang rujukan lab replaces it.
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

export const DEFAULT_TOTAL_RANGE = { low: 275, high: 295 } as const;
export const HYPOTONIC_BELOW = 275;
export const HHS_EFFECTIVE_ABOVE = 300;
export const HHS_TOTAL_ABOVE = 320;

export type Tone = 'low' | 'normal' | 'high';

export interface OsmolalityReading {
  tone: Tone;
  label: string;
}

/** What the effective value means, against the published cut-offs. */
export function readEffective(value: number): OsmolalityReading {
  if (value < HYPOTONIC_BELOW) return { tone: 'low', label: `< ${HYPOTONIC_BELOW}: hipotonik` };
  if (value > HHS_EFFECTIVE_ABOVE) {
    return { tone: 'high', label: `> ${HHS_EFFECTIVE_ABOVE}: ambang HHS (bila GDS ≥ 600)` };
  }
  return { tone: 'normal', label: 'Tidak hipotonik' };
}

/** What the total value means: the normal range (user's, or 275–295) and the HHS cut-off. */
export function readTotal(
  value: number,
  userRange?: { low: number; high: number },
): OsmolalityReading {
  const range = userRange ?? DEFAULT_TOTAL_RANGE;
  const span = `${String(range.low)}–${String(range.high)}`;
  if (value > HHS_TOTAL_ABOVE) {
    return { tone: 'high', label: `> ${HHS_TOTAL_ABOVE}: ambang HHS (bila GDS ≥ 600)` };
  }
  if (value < range.low) return { tone: 'low', label: `Di bawah normal (${span})` };
  if (value > range.high) return { tone: 'high', label: `Di atas normal (${span})` };
  return { tone: 'normal', label: `Normal (${span})` };
}

export const OSMOLALITY_SOURCES: readonly string[] = [
  'Rumus: 2·Na + glukosa/18 + BUN/2.8 (mg/dL); ureum ÷ 6 karena urea 60 g/mol vs nitrogen urea 28 g/mol. Osmolalitas efektif = 2·Na + glukosa/18 (Umpierrez et al., Diabetes Care 2024;47:1257–75).',
  'Hipotonik: osmolalitas < 275 mOsm/kg (Spasovski et al., Clinical practice guideline on hyponatraemia, Eur J Endocrinol 2014;170:G1–47; didefinisikan pada osmolalitas terukur).',
  'HHS: osmolalitas efektif > 300 atau total > 320 mOsm/kg, dengan glukosa ≥ 600 mg/dL (Umpierrez et al., Diabetes Care 2024).',
  'Rentang normal total 275–295 mOsm/kg (rentang lazim; dapat diganti di Pengaturan → Rentang rujukan lab).',
];

/**
 * The worked example in the card's "Apa itu osmolalitas efektif?" note.
 *
 * Kept here, beside the formula, and tested against `calculateOsmolality`, so
 * the numbers the explanation quotes cannot drift from what the card computes.
 * A cardiorenal patient: Na 125, glucose 90, ureum 180 mg/dL.
 */
export const EFFECTIVE_EXAMPLE = { sodium: 125, glucose: 90, urea: 180, ureaKind: 'ureum' as const, total: 285, effective: 255 };

/** Where the tonicity explanation comes from. */
export const EFFECTIVE_SOURCES: readonly string[] = [
  'Rose BD, Post TW. Clinical Physiology of Acid-Base and Electrolyte Disorders, 5th ed. New York: McGraw-Hill; 2001 (osmolalitas dan tonisitas; urea sebagai osmol tidak efektif).',
  'Spasovski G, et al. Clinical practice guideline on diagnosis and treatment of hyponatraemia. Eur J Endocrinol 2014;170:G1–47 (hiponatremia hipotonik vs non-hipotonik; urea tidak menentukan tonisitas).',
  'Umpierrez GE, et al. Hyperglycemic crises in adults with diabetes: a consensus report. Diabetes Care 2024;47:1257–75 (kriteria HHS memakai osmolalitas efektif).',
];
