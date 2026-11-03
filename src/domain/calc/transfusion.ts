/**
 * PRC volume to raise Hb to a target: ΔHb × berat badan × 4.
 *
 * The line you write is `Transfusi PRC Hb 7.5 → 10 g/dL, BB 55 kg: 550 cc
 * (±2.2 kantong @250 cc)`. The volume is an estimate to order against, then
 * re-check Hb: published formulae of this shape underestimate the volume
 * needed (Morris 2005), and the bag volume varies by blood bank, so it is an
 * input rather than an assumed constant.
 *
 * Pure, and it computes nothing it was not given: a target at or below the
 * current Hb yields no volume.
 */

export interface TransfusionInput {
  weightKg: number;
  hbNow: number;
  hbTarget: number;
  /** cc per kantong, as the blood bank issues it. */
  bagMl: number;
}

export interface TransfusionResult {
  volumeMl: number;
  bags: number;
  line: string;
}

/** ml PRC per kg per g/dL rise. */
export const PRC_FACTOR = 4;

export const TRANSFUSION_SOURCES = [
  'Volume PRC (cc) = ΔHb (g/dL) × BB (kg) × 4: Morris KP, Naqvi N, Davies P, et al. A new formula for blood transfusion volume in the critically ill. Arch Dis Child 2005;90:724–728 (tabel formula yang dipublikasikan; formula ini cenderung kurang dari volume yang dibutuhkan, periksa ulang Hb).',
  'Dewasa 70 kg: 1 unit PRC menaikkan Hb ± 1 g/dL; pertimbangkan transfusi satu unit lalu evaluasi ulang (NICE NG24, Blood transfusion, 2015).',
];

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function calculateTransfusion(input: TransfusionInput): TransfusionResult | null {
  const { weightKg, hbNow, hbTarget, bagMl } = input;
  // A null keeps the card from ever showing a negative or NaN volume.
  if (!(weightKg > 0) || !(hbNow >= 0) || !(hbTarget > hbNow) || !(bagMl > 0)) return null;

  const volumeMl = Math.round((hbTarget - hbNow) * weightKg * PRC_FACTOR);
  const bags = round(volumeMl / bagMl, 1);
  return {
    volumeMl,
    bags,
    line: `Transfusi PRC Hb ${hbNow} → ${hbTarget} g/dL, BB ${round(weightKg, 1)} kg: ${volumeMl} cc (±${bags} kantong @${bagMl} cc)`,
  };
}
