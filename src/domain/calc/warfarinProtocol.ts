/**
 * The warfarin initiation nomogram, as DATA (2026-10-10).
 *
 * Crowther MA, Harrison L, Hirsh J. "In response" (letters under "Warfarin:
 * Less May Be Better"), Ann Intern Med 1997;127:332–3, Figure "Dosing
 * nomograms for 5-mg and 10-mg warfarin doses" — the algorithm used in the
 * Harrison 1997 and Crowther 1999 trials (Arch Intern Med 1999;159:46–8:
 * "Subsequent doses were determined using published warfarin dosing
 * algorithms", reference 6 = this letter). Read from the PDF Avi supplied,
 * page 333. Only the 5-mg table: CHEST 2012 (Ageno) suggests starting doses
 * of ≤ 5 mg for the patients a ward mostly holds, and the 1999 trial found
 * 5 mg at least as effective.
 *
 * The nomogram was used in patients "with a target INR of 2.0 to 3.0" (1999
 * Methods), so it is offered only for that target.
 *
 * `printed` keeps each cell as typeset; the numbers beside it are what the
 * code uses, and a test checks the two agree.
 */

export interface WarfarinRow {
  /** INR bounds as printed; null = open-ended. */
  low: number | null;
  lowInclusive: boolean;
  high: number | null;
  highInclusive: boolean;
  /** Dose range in mg. min === max for a single dose; 0/0 = no warfarin. */
  minMg: number;
  maxMg: number;
  printed: { inr: string; dose: string };
}

export interface WarfarinDay {
  day: number;
  /** Day 1 has no INR row: the dose is fixed. */
  fixedMg?: number;
  rows: readonly WarfarinRow[];
}

const lt = (value: number, minMg: number, maxMg: number, dose: string): WarfarinRow => ({
  low: null,
  lowInclusive: false,
  high: value,
  highInclusive: false,
  minMg,
  maxMg,
  printed: { inr: `< ${value.toFixed(1)}`, dose },
});
const between = (low: number, high: number, minMg: number, maxMg: number, dose: string): WarfarinRow => ({
  low,
  lowInclusive: true,
  high,
  highInclusive: true,
  minMg,
  maxMg,
  printed: { inr: `${low.toFixed(1)} - ${high.toFixed(1)}`, dose },
});
const gt = (value: number, inr: string): WarfarinRow => ({
  low: value,
  lowInclusive: false,
  high: null,
  highInclusive: false,
  minMg: 0,
  maxMg: 0,
  printed: { inr, dose: '0.0' },
});

export const CROWTHER_5MG: readonly WarfarinDay[] = [
  { day: 1, fixedMg: 5, rows: [] },
  {
    day: 2,
    rows: [
      lt(1.5, 5, 5, '5.0 mg'),
      between(1.5, 1.9, 2.5, 2.5, '2.5 mg'),
      between(2.0, 2.5, 1, 2.5, '1.0 - 2.5 mg'),
      gt(2.5, '>2.5'),
    ],
  },
  {
    day: 3,
    rows: [
      lt(1.5, 5, 10, '5.0 - 10.0 mg'),
      between(1.5, 1.9, 2.5, 5, '2.5 - 5.0 mg'),
      between(2.0, 2.5, 0, 2.5, '0.0 - 2.5 mg'),
      between(2.5, 3.0, 0, 2.5, '0.0 - 2.5 mg'),
      gt(3.0, '> 3.0'),
    ],
  },
  {
    day: 4,
    rows: [
      lt(1.5, 10, 10, '10.0 mg'),
      between(1.5, 1.9, 5, 7.5, '5.0 - 7.5 mg'),
      between(2.0, 3.0, 0, 5, '0.0 - 5.0 mg'),
      gt(3.0, '> 3.0'),
    ],
  },
  {
    day: 5,
    rows: [
      lt(1.5, 10, 10, '10.0 mg'),
      between(1.5, 1.9, 7.5, 10, '7.5 - 10.0 mg'),
      between(2.0, 3.0, 0, 5, '0.0 - 5.0 mg'),
      gt(3.0, '> 3.0'),
    ],
  },
  {
    day: 6,
    rows: [
      lt(1.5, 7.5, 12.5, '7.5 - 12.5 mg'),
      between(1.5, 1.9, 5, 10, '5.0 - 10.0 mg'),
      between(2.0, 3.0, 0, 7.5, '0.0 - 7.5 mg'),
      gt(3.0, '> 3.0'),
    ],
  },
];
