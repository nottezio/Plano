import { describe, expect, it } from 'vitest';

import { parseJarkom } from './parseJarkom';
import type { PdfTextItem } from '@/lib/pdfItems';

const at = (y: number, cols: Array<[number, string]>): PdfTextItem[] =>
  cols.map(([x, text]) => ({ x, y, text, page: 1 }));

describe('parseJarkom', () => {
  it('reads name, agama and panggilan from the main table', () => {
    const entries = parseJarkom(
      at(700, [
        [20, '3'],
        [60, 'dr. Jordy Liong'],
        [300, 'Non Muslim'],
        [420, 'Jordy'],
        [520, 'Naima'],
      ]),
    ).entries;
    expect(entries[0]).toMatchObject({ panggilan: 'Jordy', muslim: false });
  });

  it('tests "Non Muslim" before "Muslim"', () => {
    // The second is a substring of the first, and the wrong order marks every
    // non-Muslim resident as Muslim — the one thing this document exists to
    // get right.
    const entries = parseJarkom(
      at(700, [[60, 'dr. X Y'], [300, 'Non Muslim'], [420, 'Xy']]),
    ).entries;
    expect(entries[0]?.muslim).toBe(false);
  });

  it('accepts a name with no space after "dr."', () => {
    // `dr.Glory Audrey Haurissa` appears exactly once in the 2026 sheet, and
    // requiring the space dropped her entirely.
    const entries = parseJarkom(
      at(700, [[60, 'dr.Glory Audrey Haurissa'], [300, 'Non Muslim'], [420, 'Glory']]),
    ).entries;
    expect(entries[0]?.panggilan).toBe('Glory');
  });

  it('also reads the Semnol table on the right of the same row', () => {
    // The 2026 sheet carries the PJ-Jarkom seniors there — the 14 names that
    // previously had no row and fell back to the neutral greeting forever.
    const entries = parseJarkom(
      at(700, [
        [60, 'dr. Izzan Rijal Muslim'],
        [300, 'Muslim'],
        [420, 'Izzan'],
        [520, 'Avi'],
        [640, 'dr. Mevlana Muhammad Avicenna Pasiak'],
        [900, 'Avi'],
        [980, 'C165261003'],
      ]),
    ).entries;
    expect(entries).toHaveLength(2);
    expect(entries[1]).toMatchObject({ panggilan: 'Avi', muslim: null });
  });

  it('gives the Semnol names no agama rather than guessing one', () => {
    // That side of the sheet has no agama column. `null` shows as "Agama?" on
    // the confirmation row and takes a correction.
    const entries = parseJarkom(
      at(700, [
        [60, 'dr. A B'],
        [300, 'Muslim'],
        [420, 'Ab'],
        [640, 'dr. C D'],
        [900, 'Cd'],
      ]),
    ).entries;
    expect(entries[1]?.muslim).toBeNull();
  });

  it('ignores a row with no agama at all', () => {
    expect(parseJarkom(at(700, [[60, 'dr. Someone'], [420, 'Some']])).entries).toEqual([]);
  });
});
