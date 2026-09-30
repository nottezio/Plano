/**
 * Urine output, in the unit a handover is written in.
 *
 * The line you write is `Urine output 1100 cc/24 jam/55kg: 0.83 cc/kgbb/jam` —
 * volume over hours over weight, plus the derived rate. Doing that on a phone
 * calculator means dividing twice and rounding, which is the kind of step that
 * produces a plausible wrong number at 5am.
 *
 * Pure, and it computes nothing it was not given: a missing weight yields no
 * rate rather than a guess, because a rate from an assumed weight looks exactly
 * like one from a real weight.
 */

export interface UrineOutputInput {
  volumeMl: number;
  hours: number;
  weightKg: number;
}

export interface UrineOutputResult {
  /** ml/kg/hour, the number that gets reported. */
  rate: number;
  /** Projected 24-hour volume, for a collection shorter than a day. */
  perDayMl: number;
  band: 'severe' | 'oliguria' | 'normal' | 'high';
  /** The handover line, ready to paste. */
  line: string;
}

/**
 * Bands are for orientation, not diagnosis.
 *
 * OLIGURIA by RATE, from KDIGO 2012 (AKI guideline, urine-output criteria):
 * < 0.5 ml/kg/h for 6–12 h is stage 1, for >= 12 h stage 2; < 0.3 ml/kg/h
 * for >= 24 h (or anuria >= 12 h) stage 3. So < 0.3 is a band of its own.
 * Staging is NOT attempted: it depends on how long the rate has persisted,
 * which one collection cannot establish.
 *
 * POLYURIA by VOLUME, > 3 L per 24 h in an adult (Merck Manual; the usual
 * definition). It used to be a rate above 3.0 ml/kg/h, which is not a
 * published threshold: at 60 kg that is 4.3 L/day, so 3–4.3 L/day was called
 * "Cukup". A shorter collection is projected to 24 h.
 */
function bandFor(rate: number, perDayMl: number): UrineOutputResult['band'] {
  if (rate < 0.3) return 'severe';
  if (rate < 0.5) return 'oliguria';
  if (perDayMl > 3000) return 'high';
  return 'normal';
}

export const BAND_LABELS: Record<UrineOutputResult['band'], string> = {
  severe: 'Oliguria berat (< 0.3 cc/kgbb/jam)',
  oliguria: 'Oliguria (< 0.5 cc/kgbb/jam)',
  normal: 'Bukan oliguria (≥ 0.5 cc/kgbb/jam)',
  high: 'Poliuria (> 3 L/24 jam)',
};

export const URINE_OUTPUT_SOURCES = [
  'KDIGO Clinical Practice Guideline for Acute Kidney Injury. Kidney Int Suppl 2012;2:1–138 — kriteria urine output: < 0.5 cc/kgbb/jam 6–12 jam (stage 1), ≥ 12 jam (stage 2); < 0.3 cc/kgbb/jam ≥ 24 jam atau anuria ≥ 12 jam (stage 3).',
  'Poliuria: > 3 L/24 jam pada dewasa (Merck Manual Professional, Polyuria).',
];

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function calculateUrineOutput(input: UrineOutputInput): UrineOutputResult | null {
  const { volumeMl, hours, weightKg } = input;

  // Each of these is a division by zero or a nonsense input; returning null
  // keeps the caller from ever displaying Infinity or NaN as a clinical value.
  if (!(volumeMl >= 0) || !(hours > 0) || !(weightKg > 0)) return null;

  const exact = volumeMl / weightKg / hours;
  /*
    The band is decided on the EXACT rate. Rounding first turned 0.496 into
    0.5 and called oliguria "Cukup". Shown to 2 decimals as the ward writes
    it, or 3 when 2 would round across a band boundary, so the number and
    the band never disagree.
  */
  const perDayMl = Math.round((volumeMl / hours) * 24);
  const twoPlaces = round(exact, 2);
  const rate =
    bandFor(twoPlaces, perDayMl) === bandFor(exact, perDayMl) ? twoPlaces : round(exact, 3);

  return {
    rate,
    perDayMl,
    band: bandFor(exact, perDayMl),
    line: `Urine output ${volumeMl} cc/${round(hours, 2)} jam/${round(weightKg, 1)}kg: ${rate} cc/kgbb/jam`,
  };
}
