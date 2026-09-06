import { describe, expect, it } from 'vitest';

import { tintFor } from './sectionTint';
import type { SectionId } from '../types';

const tint = (id: string, label: string): string | null =>
  tintFor(id as SectionId, label);

describe('tintFor', () => {
  it('does not read "plan" out of the middle of "Implantasi"', () => {
    /*
     * The bug this file exists for. Keywords were matched with `includes`, so
     * `plan` matched Im-PLAN-tasi and a real note's procedure report was
     * tinted as therapy.
     *
     * The expensive half was downstream: bands mark the FIRST heading of each
     * kind, so this line — which sits above the assessment — claimed the
     * therapy colour and left the actual therapy and plan headings plain.
     */
    expect(tint('custom_laporan_implantasi_ppm', 'Laporan Implantasi PPM (04-09-2026)')).not.toBe(
      'terapi',
    );
  });

  it('files a procedure report with the investigations, where it is read', () => {
    expect(tint('custom_laporan_implantasi_ppm', 'Laporan Implantasi PPM (04-09-2026)')).toBe('o');
  });

  it('still matches stems at the start of a word', () => {
    // Word START, not whole word: these have to reach their longer forms.
    expect(tint('custom_diagnosis_kerja', 'Diagnosis Kerja')).toBe('a');
    expect(tint('custom_monitoring', 'Monitoring')).toBe('terapi');
    expect(tint('custom_angiografi', 'Angiografi')).toBe('o');
    expect(tint('custom_laboratorium', 'Laboratorium')).toBe('o');
  });

  it('gives terapi and plan the same colour, as designed', () => {
    // Six bands for a dozen headings. Sharing a colour is intended; what was
    // not intended was the two competing for it.
    expect(tint('terapi', 'Terapi')).toBe('terapi');
    expect(tint('p', 'Plan')).toBe('terapi');
  });

  it('leaves an unrecognised heading untinted rather than guessing', () => {
    expect(tint('custom_catatan_khusus', 'Catatan Khusus')).toBeNull();
  });
});
