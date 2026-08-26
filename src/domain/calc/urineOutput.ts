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
 * Corrected against the sources: **≥0.5 ml/kg/h is adequate** in an adult, so
 * the old 0.5–1.0 band labelled "Rendah" was wrong — it called a normal output
 * low. KDIGO uses <0.5 for AKI stages 1–2 and <0.3 for stage 3, which is why
 * 0.3 is a band of its own.
 *
 * Staging is deliberately NOT attempted: it depends on how long the rate has
 * persisted (6h, 12h, 24h), and a single collection cannot establish that. The
 * band is a word, never a colour alone and never advice.
 */
function bandFor(rate: number): UrineOutputResult['band'] {
  if (rate < 0.3) return 'severe';
  if (rate < 0.5) return 'oliguria';
  if (rate <= 3) return 'normal';
  return 'high';
}

export const BAND_LABELS: Record<UrineOutputResult['band'], string> = {
  severe: 'Oliguria berat (<0.3)',
  oliguria: 'Oliguria (<0.5)',
  normal: 'Cukup (0.5–3.0)',
  high: 'Poliuria (>3.0)',
};

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function calculateUrineOutput(input: UrineOutputInput): UrineOutputResult | null {
  const { volumeMl, hours, weightKg } = input;

  // Each of these is a division by zero or a nonsense input; returning null
  // keeps the caller from ever displaying Infinity or NaN as a clinical value.
  if (!(volumeMl >= 0) || !(hours > 0) || !(weightKg > 0)) return null;

  const rate = round(volumeMl / weightKg / hours, 2);

  return {
    rate,
    perDayMl: Math.round((volumeMl / hours) * 24),
    band: bandFor(rate),
    line: `Urine output ${volumeMl} cc/${round(hours, 2)} jam/${round(weightKg, 1)}kg: ${rate} cc/kgbb/jam`,
  };
}
