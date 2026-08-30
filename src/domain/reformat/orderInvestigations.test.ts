import { describe, expect, it } from 'vitest';

import { orderInvestigations } from './orderInvestigations';

/** Shuffled on purpose — a CVCU note distributes these across A–H sections. */
const SHUFFLED = [
  '*Echo Hemodinamik CVCU (28-08-2026)*',
  'TD : 137/93 (MAP : 107)',
  '',
  '*Foto Thorax PJT (25-08-2026)*',
  'Slight cardiomegaly disertai dilatatio et atherosclerosis aortae',
  '',
  '*Laboratorium PJT (26-08-2026)*',
  'APTT 36.1',
  '',
  '*EKG di CVCU (28-08-2026)*',
  'Sinus Rhythm, HR 71 bpm',
  '',
  '*Laporan MSCT Cardiac PJT 26-08-2026*',
  'CT Calcium scoring : 462.61 unit',
  '',
  '*Laboratorium PJT (24-08-2026)*',
  'WBC 8.430',
  '',
  '*EKG di IGD PJT (24-08-2026)*',
  'Sinus Rhythm, HR 75 bpm',
];

function headings(lines: readonly string[]): string[] {
  return lines.filter((line) => /^\s*\*.+\*\s*$/.test(line));
}

describe('orderInvestigations', () => {
  const ordered = orderInvestigations(SHUFFLED);

  it('runs EKG, lab, film, cross-sectional, echo', () => {
    // The order both real flat formats use, independently: the IGD admission
    // note and the bangsal transfer note.
    expect(headings(ordered)).toEqual([
      '*EKG di CVCU (28-08-2026)*',
      '*EKG di IGD PJT (24-08-2026)*',
      '*Laboratorium PJT (26-08-2026)*',
      '*Laboratorium PJT (24-08-2026)*',
      '*Foto Thorax PJT (25-08-2026)*',
      '*Laporan MSCT Cardiac PJT 26-08-2026*',
      '*Echo Hemodinamik CVCU (28-08-2026)*',
    ]);
  });

  it('runs newest first inside a modality', () => {
    // A five-day EKG run read oldest-first buries today's tracing.
    const ekg = headings(ordered).filter((h) => h.includes('EKG'));
    expect(ekg[0]).toContain('28-08-2026');
  });

  it('keeps each block with its own content', () => {
    const text = ordered.join('\n');
    expect(text).toContain('*EKG di CVCU (28-08-2026)*\nSinus Rhythm, HR 71 bpm');
    expect(text).toContain('*Laboratorium PJT (24-08-2026)*\nWBC 8.430');
  });

  it('discards nothing', () => {
    const before = SHUFFLED.filter((line) => line.trim() !== '').sort();
    const after = orderInvestigations(SHUFFLED).filter((line) => line.trim() !== '').sort();
    expect(after).toEqual(before);
  });

  it('puts an unrecognised block last rather than dropping it', () => {
    // A transform that silently loses a finding is worse than none: the note
    // still looks complete.
    const withOdd = [...SHUFFLED, '', '*Konsul Gizi (28-08-2026)*', 'Diet jantung'];
    const result = orderInvestigations(withOdd);
    expect(headings(result).at(-1)).toBe('*Konsul Gizi (28-08-2026)*');
    expect(result.join('\n')).toContain('Diet jantung');
  });

  it('is stable for undated blocks of the same modality', () => {
    const undated = [
      '*EKG pertama*', 'a',
      '',
      '*EKG kedua*', 'b',
    ];
    expect(headings(orderInvestigations(undated))).toEqual(['*EKG pertama*', '*EKG kedua*']);
  });

  it('does not move a dated block relative to an undated one of the same rank', () => {
    // Inventing a date for the undated block would move it for a reason that
    // is not written in the note.
    const mixed = ['*EKG tanpa tanggal*', 'a', '', '*EKG (28-08-2026)*', 'b'];
    expect(headings(orderInvestigations(mixed))).toEqual([
      '*EKG tanpa tanggal*',
      '*EKG (28-08-2026)*',
    ]);
  });

  it('leaves a single block alone', () => {
    const one = ['*EKG di CVCU (28-08-2026)*', 'Sinus Rhythm'];
    expect(orderInvestigations(one)).toEqual(one);
  });

  it('keeps content that appears before any heading', () => {
    const orphan = ['catatan lepas', '', '*EKG (28-08-2026)*', 'x'];
    expect(orderInvestigations(orphan).join('\n')).toContain('catatan lepas');
  });
});
