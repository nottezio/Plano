/**
 * Unit conversions for the lab values the ward converts by hand.
 *
 * Every factor is derived from a molar mass, never a remembered constant, so
 * the source of each number is chemistry anyone can check:
 *
 *   urea            CH4N2O   60.06 g/mol
 *   urea nitrogen   2 × N    28.014 g/mol   (what "BUN" measures)
 *   creatinine      C4H7N3O  113.12 g/mol
 *   glucose         C6H12O6  180.16 g/mol
 *
 * mg/dL → mmol/L is ÷ (molar mass / 10); mg/dL → µmol/L is × (10000 / molar
 * mass). Ureum ÷ BUN is 60.06 / 28.014 = 2.144: SIMGOS prints UREUM, most
 * guidelines and calculators (KDIGO, MDCalc, the osmolality formula with ÷2.8)
 * expect BUN.
 */

export const MOLAR_MASS = {
  urea: 60.06,
  ureaNitrogen: 28.014,
  creatinine: 113.12,
  glucose: 180.16,
} as const;

/** Ureum (mg/dL) per BUN (mg/dL). */
export const UREUM_PER_BUN = MOLAR_MASS.urea / MOLAR_MASS.ureaNitrogen;

export type UreaUnit = 'ureum' | 'bun' | 'mmol';

export interface UreaValues {
  /** Ureum, mg/dL. */
  ureum: number;
  /** Blood urea nitrogen, mg/dL. */
  bun: number;
  /** Urea, mmol/L (identical for ureum and BUN: one urea has one pair of N). */
  mmol: number;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function convertUrea(value: number, from: UreaUnit): UreaValues | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const mmol =
    from === 'mmol'
      ? value
      : from === 'ureum'
        ? value / (MOLAR_MASS.urea / 10)
        : value / (MOLAR_MASS.ureaNitrogen / 10);
  return {
    ureum: round(mmol * (MOLAR_MASS.urea / 10), 1),
    bun: round(mmol * (MOLAR_MASS.ureaNitrogen / 10), 1),
    mmol: round(mmol, 2),
  };
}

export type CreatinineUnit = 'mgdl' | 'umol';

export function convertCreatinine(
  value: number,
  from: CreatinineUnit,
): { mgdl: number; umol: number } | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const perMgdl = 10000 / MOLAR_MASS.creatinine; // 88.4 µmol/L per mg/dL
  const mgdl = from === 'mgdl' ? value : value / perMgdl;
  return { mgdl: round(mgdl, 2), umol: round(mgdl * perMgdl, 0) };
}

export type GlucoseUnit = 'mgdl' | 'mmol';

export function convertGlucose(
  value: number,
  from: GlucoseUnit,
): { mgdl: number; mmol: number } | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const perMmol = MOLAR_MASS.glucose / 10; // 18.016 mg/dL per mmol/L
  const mmol = from === 'mmol' ? value : value / perMmol;
  return { mgdl: round(mmol * perMmol, 0), mmol: round(mmol, 1) };
}
