import { describe, expect, it } from 'vitest';

import { bumpDayMarkers, daysBetween, findDayMarkers } from './dayMarkers';
import type { ClinicalDate } from './types';

describe('findDayMarkers', () => {
  it('finds every form the corpus writes', () => {
    const body = [
      '- Symptomatic Bradicardia ec Sinus Node Dysfunction post PPM H-2',
      '- Ceftriaxone 2gr/24 jam/IV (H-3)',
      '_Paska tindakan CABG hari ke-9_',
      'Post op H 4',
    ].join('\n');
    expect(findDayMarkers(body).map((marker) => marker.value)).toEqual([2, 3, 9, 4]);
  });

  it('does not claim numbers that are not day counters', () => {
    /*
     * Bumping something that was never a counter is far worse than missing
     * one. A missed counter is a number the resident was going to check
     * anyway; an invented one is a number nobody knows is wrong.
     */
    const body = [
      'Tekanan Darah : 160/83 mmHg',
      'RM 01714792',
      '22-07-1949',
      'Hb 10.2',
      'Furosemide 40 mg',
    ].join('\n');
    expect(findDayMarkers(body)).toEqual([]);
  });
});

describe('bumpDayMarkers', () => {
  it('advances every counter by the same number of days', () => {
    // They measure from different starts but all advance at one day per day.
    const body = 'post PPM H-2, Ceftriaxone (H-3), CABG hari ke-9';
    expect(bumpDayMarkers(body, 1)).toBe('post PPM H-3, Ceftriaxone (H-4), CABG hari ke-10');
  });

  it('uses the real gap, not one', () => {
    // Friday's note opened on Monday moves three days, not one.
    expect(bumpDayMarkers('H-2', 3)).toBe('H-5');
  });

  it('keeps the author spacing, case and separator', () => {
    // Only the digits are a function of the date.
    expect(bumpDayMarkers('post op H 4 dan hari ke - 7', 1)).toBe(
      'post op H 5 dan hari ke - 8',
    );
  });

  it('is a no-op for a zero gap', () => {
    const body = 'H-2 dan hari ke-9';
    expect(bumpDayMarkers(body, 0)).toBe(body);
  });

  it('refuses to produce a counter below one', () => {
    // Reaching this means the dates ran backwards. Day zero of a course of
    // antibiotics is not something anybody writes.
    expect(bumpDayMarkers('H-1', -5)).toBe('H-1');
  });

  it('leaves the rest of the note byte for byte', () => {
    const body = 'Tekanan Darah : 160/83 mmHg\nRM 01714792\n22-07-1949';
    expect(bumpDayMarkers(body, 2)).toBe(body);
  });
});

describe('daysBetween', () => {
  it('counts calendar days', () => {
    expect(daysBetween('2026-09-04' as ClinicalDate, '2026-09-07' as ClinicalDate)).toBe(3);
  });

  it('crosses a month end', () => {
    expect(daysBetween('2026-08-31' as ClinicalDate, '2026-09-01' as ClinicalDate)).toBe(1);
  });

  it('returns null for the admission note, which is not a date', () => {
    // "Do not bump" and "bump by nothing" happen to do the same thing today; a
    // caller should not have to rely on that.
    expect(daysBetween('IGD' as ClinicalDate, '2026-09-07' as ClinicalDate)).toBeNull();
  });
});

describe('markers inside italic lines', () => {
  it('finds a counter with an underscore hard against it', () => {
    /*
     * `_` is a word character, so `\b` found no boundary between `9` and `_`.
     * Most day counters live in the italic opening zone — `_Paska tindakan …_`,
     * `_Post Tindakan : …_` — so a `\b`-bounded pattern would have skipped
     * almost every one of them, silently.
     */
    expect(findDayMarkers('_Paska tindakan CABG hari ke-9_')).toHaveLength(1);
    expect(bumpDayMarkers('_Paska tindakan CABG hari ke-9_', 1)).toBe(
      '_Paska tindakan CABG hari ke-10_',
    );
  });

  it('bumps a counter in a bold assessment line', () => {
    expect(
      bumpDayMarkers('- Symptomatic Bradicardia ec Sinus Node Dysfunction post PPM H-2', 1),
    ).toBe('- Symptomatic Bradicardia ec Sinus Node Dysfunction post PPM H-3');
  });
});
