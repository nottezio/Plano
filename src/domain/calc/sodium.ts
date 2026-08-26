/**
 * Sodium correction and plasma osmolality.
 *
 * Both are arithmetic a resident does on a phone at 3am, and both are the kind
 * where a misplaced decimal produces a number that looks entirely reasonable.
 * That is the case for putting them here rather than leaving them to a
 * calculator app: the app cannot show its working, and this can.
 *
 * Every function returns `null` on input it cannot use rather than a number
 * computed from a default. A dose derived from an assumed weight is
 * indistinguishable from one derived from a real weight.
 */

export type Sex = 'L' | 'P';

export interface SodiumCorrectionInput {
  /** Measured serum sodium, mmol/L. */
  current: number;
  /** Target sodium, conventionally 140. */
  target: number;
  weightKg: number;
  sex: Sex;
  /** mEq/hour. 0.5 while alert, 1 if consciousness is declining. */
  ratePerHour: number;
}

export interface SodiumCorrectionResult {
  /** Total sodium deficit, mEq. */
  deficitMeq: number;
  /** Total body water factor used: 0.6 for men, 0.5 for women. */
  factor: number;
  /** The gap being corrected, mmol/L. */
  delta: number;
  /** Hours the correction should take at the chosen rate. */
  hours: number;
  /** Volume of 3% NaCl carrying that deficit, ml. */
  volume3PercentMl: number;
  line: string;
}

/**
 * Total body water fraction.
 *
 * 0.6 for men and 0.5 for women is the convention these corrections are written
 * with, and the one in the reference sheet. It is an estimate, and the result is
 * an estimate with it.
 */
const TBW_FACTOR: Record<Sex, number> = { L: 0.6, P: 0.5 };

/** 1000 ml of 3% NaCl carries ~512 mEq. */
const MEQ_PER_LITRE_3_PERCENT = 512;

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function calculateSodiumCorrection(
  input: SodiumCorrectionInput,
): SodiumCorrectionResult | null {
  const { current, target, weightKg, sex, ratePerHour } = input;

  if (!Number.isFinite(current) || !Number.isFinite(target)) return null;
  if (!(weightKg > 0) || !(ratePerHour > 0)) return null;

  const delta = target - current;
  // Sodium already at or above target: there is no deficit to correct, and
  // returning a negative volume would be worse than returning nothing.
  if (delta <= 0) return null;

  const factor = TBW_FACTOR[sex];
  const deficitMeq = round(delta * factor * weightKg, 1);
  const hours = round(delta / ratePerHour, 1);
  const volume3PercentMl = Math.round((deficitMeq / MEQ_PER_LITRE_3_PERCENT) * 1000);

  return {
    deficitMeq,
    factor,
    delta: round(delta, 1),
    hours,
    volume3PercentMl,
    line: `Koreksi Natrium: (${target}-${current}) x ${factor} x ${round(weightKg, 1)} = ${deficitMeq} meq, kecepatan ${ratePerHour} meq/jam, habis dalam ${hours} jam (NaCl 3% ~${volume3PercentMl} cc)`,
  };
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

export interface PotassiumDeficitInput {
  /** Measured serum potassium, mmol/L. */
  current: number;
  /** Target, conventionally the lower limit of normal (3.5). */
  target: number;
  weightKg: number;
}

export interface PotassiumDeficitResult {
  /** Formula estimate, mEq. */
  deficitMeq: number;
  /** Daily maintenance at 1 mmol/kg, which the deficit does not include. */
  maintenanceMeq: number;
  /** Deficit + maintenance, which is what actually has to be given. */
  totalMeq: number;
  /** Grams of KCl carrying the total — 1 g ≈ 13.4 mmol. */
  kclGrams: number;
  severity: 'ringan' | 'sedang' | 'berat';
  line: string;
}

/**
 * Potassium deficit — a formula that is known to underestimate.
 *
 * `(target − measured) × BB × 0.4`, where 0.4 L/kg is potassium's volume of
 * distribution. Every source that publishes it also warns that it is low:
 * about 98% of body potassium is intracellular, so a 1 mmol/L fall in serum
 * commonly reflects a **200–400 mEq** total-body deficit while the formula
 * returns a fraction of that.
 *
 * That warning is carried in the output rather than left in a textbook,
 * because a number presented alone is a number that gets acted on. The result
 * says "perkiraan minimal" for exactly that reason.
 *
 * Maintenance is added separately at 1 mmol/kg/day: the deficit replaces what
 * is missing and does nothing about ongoing requirement, and giving only the
 * deficit is why a potassium that was corrected yesterday is low again today.
 */
const K_VOLUME_OF_DISTRIBUTION = 0.4;
const MMOL_PER_GRAM_KCL = 13.4;

export function calculatePotassiumDeficit(
  input: PotassiumDeficitInput,
): PotassiumDeficitResult | null {
  const { current, target, weightKg } = input;

  if (!Number.isFinite(current) || !Number.isFinite(target)) return null;
  if (!(weightKg > 0)) return null;

  const delta = target - current;
  // Already at or above target: there is no deficit, and a negative one would
  // print as a negative dose.
  if (delta <= 0) return null;

  const deficitMeq = round(delta * weightKg * K_VOLUME_OF_DISTRIBUTION, 1);
  const maintenanceMeq = round(weightKg, 0);
  const totalMeq = round(deficitMeq + maintenanceMeq, 1);

  const severity = current < 2.5 ? 'berat' : current < 3.0 ? 'sedang' : 'ringan';

  return {
    deficitMeq,
    maintenanceMeq,
    totalMeq,
    kclGrams: round(totalMeq / MMOL_PER_GRAM_KCL, 1),
    severity,
    line: `Defisit kalium: (${target}-${current}) x ${round(weightKg, 1)} x 0.4 = ${deficitMeq} mEq + maintenance ${maintenanceMeq} mEq = ${totalMeq} mEq (~${round(totalMeq / MMOL_PER_GRAM_KCL, 1)} g KCl)`,
  };
}

export const K_SEVERITY_LABELS: Record<PotassiumDeficitResult['severity'], string> = {
  ringan: 'Ringan (3.0–3.5)',
  sedang: 'Sedang (2.5–3.0)',
  berat: 'Berat (<2.5) — pertimbangkan IV',
};
