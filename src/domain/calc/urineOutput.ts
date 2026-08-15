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
  band: 'oliguria' | 'low' | 'normal' | 'high';
  /** The handover line, ready to paste. */
  line: string;
}

/**
 * Bands are for orientation, not diagnosis.
 *
 * 0.5 ml/kg/h is the conventional oliguria threshold. The band is shown as a
 * word, never as a colour alone and never as advice — what it means depends on
 * the patient, and the app does not know the patient.
 */
function bandFor(rate: number): UrineOutputResult['band'] {
  if (rate < 0.5) return 'oliguria';
  if (rate < 1) return 'low';
  if (rate <= 3) return 'normal';
  return 'high';
}

export const BAND_LABELS: Record<UrineOutputResult['band'], string> = {
  oliguria: 'Oliguria (<0.5)',
  low: 'Rendah (0.5–1.0)',
  normal: 'Normal (1.0–3.0)',
  high: 'Tinggi (>3.0)',
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
