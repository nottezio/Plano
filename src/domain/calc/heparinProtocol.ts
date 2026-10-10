/**
 * The heparin nomogram, as DATA (2026-10-10).
 *
 * Copied from Raschke RA et al., Ann Intern Med 1993;119:874–81, Table 2
 * "Weight-based Nomogram", checked against the PDF Avi supplied (page 875).
 * The `printed` strings are the table's own cells, character for character
 * (the asterisk on the first "APTT*" footnote omitted); the code computes
 * from the numeric fields beside them, and a test checks the two agree.
 *
 * The table gives each row in seconds AND as a multiple of control. Plano
 * uses the MULTIPLE: the seconds were the authors' lab (plain Dade Actin,
 * normal range 20–30 s, control 30 s), and the paper itself says other labs
 * should use "APTT ratios (actual APTT/control APTT), as shown in Table 2".
 *
 * Replaceable: a hospital protocol is another `HeparinProtocol` with its own
 * rows. Nothing outside this file knows the numbers.
 */

export interface HeparinRow {
  id: string;
  /**
   * Upper bound of the row as aPTT / control. Null for the last row.
   * `maxInclusive` says whether a ratio exactly on the bound belongs here.
   */
  maxRatio: number | null;
  maxInclusive: boolean;
  /** Bolus to give, units per kg. 0 = none. */
  bolusPerKg: number;
  /** Change to the infusion, units/kg/h: +4, +2, 0, -2, -3. */
  rateChangePerKg: number;
  /** Infusion held before the new rate starts, minutes. */
  holdMinutes: number;
  /** The therapeutic ("no change") row. */
  therapeutic: boolean;
  /** As printed in the source table. */
  printed: { range: string; action: string };
}

export interface HeparinProtocol {
  id: string;
  name: string;
  initial: { bolusPerKg: number; ratePerKg: number; printed: string };
  rows: readonly HeparinRow[];
  /** Hours from a dose change to the next aPTT. */
  recheckHours: number;
  /** An aPTT drawn sooner than this after a change is not acted on. */
  minHoursAfterChange: number;
}

/*
  Row boundaries. The table's ranges touch ("1.2 to 1.5", "1.5 to 2.3"), so
  which row owns a ratio exactly on a bound is decided from the paper's own
  definitions, not guessed:
  - 1.5×: "an APTT value exceeding the 'therapeutic threshold' of 45 seconds
    (1.5 times the control APTT)" — so 1.5 itself is NOT yet therapeutic and
    belongs to the 1.2–1.5 row. Its seconds column agrees: 45 s is in
    "35 to 45s".
  - 2.3× and 3×: the seconds column puts 70 s in "46 to 70s" and 90 s in
    "71 to 90s", so the upper bounds are inclusive.
  - 1.2×: "<35s (<1.2 × control)" is strict.
*/
export const RASCHKE_1993: HeparinProtocol = {
  id: 'raschke-1993',
  name: 'Raschke 1993 (berbasis berat badan)',
  initial: { bolusPerKg: 80, ratePerKg: 18, printed: '80 u/kg bolus, then 18 u/kg · h' },
  rows: [
    {
      id: 'below-1.2',
      maxRatio: 1.2,
      maxInclusive: false,
      bolusPerKg: 80,
      rateChangePerKg: 4,
      holdMinutes: 0,
      therapeutic: false,
      printed: { range: 'APTT <35s (<1.2 × control)', action: '80 u/kg bolus, then 4 u/kg · h' },
    },
    {
      id: '1.2-1.5',
      maxRatio: 1.5,
      maxInclusive: true,
      bolusPerKg: 40,
      rateChangePerKg: 2,
      holdMinutes: 0,
      therapeutic: false,
      printed: { range: 'APTT, 35 to 45s (1.2 to 1.5 × control)', action: '40 u/kg bolus, then 2 u/kg · h' },
    },
    {
      id: '1.5-2.3',
      maxRatio: 2.3,
      maxInclusive: true,
      bolusPerKg: 0,
      rateChangePerKg: 0,
      holdMinutes: 0,
      therapeutic: true,
      printed: { range: 'APTT, 46 to 70s (1.5 to 2.3 × control)', action: 'No change' },
    },
    {
      id: '2.3-3',
      maxRatio: 3,
      maxInclusive: true,
      bolusPerKg: 0,
      rateChangePerKg: -2,
      holdMinutes: 0,
      therapeutic: false,
      printed: { range: 'APTT, 71 to 90s (2.3 to 3 × control)', action: 'Decrease infusion rate by 2 u/kg · h' },
    },
    {
      id: 'above-3',
      maxRatio: null,
      maxInclusive: false,
      bolusPerKg: 0,
      rateChangePerKg: -3,
      holdMinutes: 60,
      therapeutic: false,
      printed: {
        range: 'APTT >90s (>3 × control)',
        action: 'Hold infusion 1 hour, then decrease infusion rate by 3 u/kg · h',
      },
    },
  ],
  // "'Stat' APTT levels were drawn every 6 hours."
  recheckHours: 6,
  // "No adjustments were made if blood for the APTT was drawn less than
  // 4 hours after the last heparin dose adjustment was made."
  minHoursAfterChange: 4,
};

/**
 * The upper end of the target, as a multiple of control. Two published
 * choices, nothing in between:
 *  - 2.3: Raschke's own therapeutic range (1.5 to 2.3 × control);
 *  - 2.5: "a therapeutic aPTT range of 1.5 to 2.5 times control gained wide
 *    acceptance" (Garcia et al., CHEST 2012, citing Basu et al. 1972).
 * Choosing 2.5 moves the edge between the "no change" row and the
 * "decrease by 2" row; every other row is untouched.
 */
export const TARGET_HIGH_CHOICES = [
  { value: 2.3, label: '1,5–2,3 × kontrol (Raschke 1993)' },
  { value: 2.5, label: '1,5–2,5 × kontrol (CHEST 2012; Basu 1972)' },
] as const;

export type TargetHigh = (typeof TARGET_HIGH_CHOICES)[number]['value'];

export function withTargetHigh(protocol: HeparinProtocol, high: TargetHigh): HeparinProtocol {
  if (high === 2.3) return protocol;
  return {
    ...protocol,
    rows: protocol.rows.map((row) => (row.therapeutic ? { ...row, maxRatio: high } : row)),
  };
}

/**
 * Acute coronary syndrome, ESC 2023 (2026-10-10).
 *
 * Byrne RA et al., 2023 ESC Guidelines for the management of acute coronary
 * syndromes, Eur Heart J 2023;44:3720–826, Table 6 (p. 3751–2), UFH row,
 * verbatim: "Initial treatment: i.v. bolus 70–100 U/kg followed by i.v.
 * infusion titrated to achieve an aPTT of 60–80 s." Read from the PDF Avi
 * supplied.
 *
 * Note what it does NOT say: no maximum bolus, no starting infusion rate,
 * and no adjustment table. The card shows exactly that — a bolus RANGE, the
 * aPTT window, and whether a result is below, in or above it — and does not
 * borrow Raschke's per-kg steps for a regimen they were not written for.
 */
export const ESC_2023_ACS = {
  bolusPerKg: { min: 70, max: 100 },
  apttSeconds: { low: 60, high: 80 },
  printed:
    'Initial treatment: i.v. bolus 70–100 U/kg followed by i.v. infusion titrated to achieve an aPTT of 60–80 s.',
} as const;
