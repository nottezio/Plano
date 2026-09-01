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
  /**
   * Daily maintenance at 1 mmol/kg, reported alongside and NEVER added to the
   * correction dose — adding it was the bug this rewrite fixes.
   */
  maintenanceMeq: number;
  /**
   * The correction dose. Equal to `deficitMeq`; kept as a field because
   * callers render it, and because a "total" that silently differed from the
   * dose is what went wrong before.
   */
  totalMeq: number;
  /** Grams of KCl carrying the total — 1 g ≈ 13.4 mmol. */
  kclGrams: number;
  severity: 'ringan' | 'sedang' | 'berat';
  /** True when the estimate exceeded the 200 mEq/24h ceiling and was clamped. */
  cappedAtDailyMax: boolean;
  /** Ceiling infusion rate for this severity, mEq/hour. */
  maxRatePerHour: number;
  /** Hours the dose takes at that rate. */
  hours: number;
  line: string;
}

/**
 * Potassium replacement for IV correction.
 *
 * REWRITTEN. The previous version computed `(target − measured) × BB × 0.4`,
 * a TOTAL BODY deficit, and then added a full day's maintenance at 1 mmol/kg
 * on top — 78 mEq for a 78 kg patient — and presented the sum as the amount to
 * give. Those are three different quantities and only one of them is a dose.
 *
 * Total body deficit is genuinely large: references put it at 200–400 mEq for
 * each 1 mEq/L the serum has fallen, because about 98% of body potassium is
 * intracellular. But it is not what goes in the infusion. Giving a total-body
 * figure as an IV order is how someone gets hyperkalaemic, and the maintenance
 * addition made the printed number larger still.
 *
 * What IV correction actually runs on is the observed dose-response:
 * approximately **10 mEq raises serum potassium by about 0.1 mEq/L**, i.e.
 * roughly 0.25 mEq/L per 20 mEq infused. That is the number this returns.
 *
 * It is explicitly a STARTING dose with a recheck, not a total. Serum
 * potassium does not move linearly, the intracellular pool refills as it
 * rises, and every source that publishes the rule pairs it with "recheck 1–2
 * hours after the infusion".
 *
 * Sources: StatPearls (NBK539791); Medscape potassium chloride dosing;
 * Vanderbilt electrolyte repletion guideline.
 */

/** mEq of KCl that raises serum potassium by roughly 0.1 mEq/L. */
const MEQ_PER_0_1_RISE = 10;
const MMOL_PER_GRAM_KCL = 13.4;

/**
 * Ceilings, so the suggested dose cannot exceed what may be given in a day.
 *
 * 200 mEq/24h at serum potassium above 2.5; 400 mEq/24h only in
 * life-threatening hypokalaemia with continuous ECG and central access. The
 * calculator suggests the lower one and says so — it cannot see the monitor.
 */
const MAX_DAILY_MEQ = 200;

export function calculatePotassiumDeficit(
  input: PotassiumDeficitInput,
): PotassiumDeficitResult | null {
  const { current, target, weightKg } = input;

  if (!Number.isFinite(current) || !Number.isFinite(target)) return null;
  // Weight is no longer used in the dose — the dose-response rule is not
  // weight-based — but it is still required, because refusing to calculate
  // without it is what stops a number appearing for a patient nobody weighed.
  if (!(weightKg > 0)) return null;

  const delta = target - current;
  if (delta <= 0) return null;

  /**
   * The replacement dose, from the dose-response rule.
   *
   * Rounded DOWN to the nearest 10 mEq, because KCl is ordered in 10 and 20
   * mEq units and rounding up would order more than the estimate supports.
   */
  const raw = (delta / 0.1) * MEQ_PER_0_1_RISE;
  const capped = Math.min(raw, MAX_DAILY_MEQ);
  const deficitMeq = Math.max(10, Math.floor(capped / 10) * 10);

  const severity = current < 2.5 ? 'berat' : current < 3.0 ? 'sedang' : 'ringan';

  /**
   * Maintenance is reported SEPARATELY and never added.
   *
   * Adding it was the bug. Ongoing requirement is a different order on a
   * different schedule; folding it into a correction dose inflates the
   * correction by roughly a whole day's intake.
   */
  const maintenanceMeq = round(weightKg, 0);

  /** Hours at the ceiling rate for this severity, so the order is writable. */
  const maxRatePerHour = severity === 'berat' ? 20 : 10;
  const hours = Math.ceil(deficitMeq / maxRatePerHour);

  return {
    deficitMeq,
    maintenanceMeq,
    totalMeq: deficitMeq,
    kclGrams: round(deficitMeq / MMOL_PER_GRAM_KCL, 1),
    severity,
    cappedAtDailyMax: raw > MAX_DAILY_MEQ,
    maxRatePerHour,
    hours,
    line: `Koreksi kalium: target ${target} - K ${current} = ${round(delta, 2)} mmol/L, ~${deficitMeq} mEq KCl (10 mEq ~ 0.1 mmol/L), maks ${maxRatePerHour} mEq/jam, ~${hours} jam. Cek ulang K 1-2 jam setelah infus.`,
  };
}

export const K_SEVERITY_LABELS: Record<PotassiumDeficitResult['severity'], string> = {
  ringan: 'Ringan (3.0–3.5)',
  sedang: 'Sedang (2.5–3.0)',
  berat: 'Berat (<2.5) — pertimbangkan IV',
};
