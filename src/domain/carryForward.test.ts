import { describe, expect, it } from 'vitest';

import { carryForward, carryForwardSummary } from './carryForward';
import type { SectionId } from './types';

const CLEAR: SectionId[] = ['s', 'penunjang'];

const YESTERDAY = [
  'Tn. B, 52th, Melati 3B',
  'S: sesak berkurang, batuk berdahak',
  'O:',
  'TTV: TD 130/80, N 92',
  'Penunjang: Hb 10.2, Leu 14.300',
  'A: Pneumonia komunitas',
  'P:',
  '- Lanjut O2 3 lpm',
  'Th/ Ceftriaxone 2x1 g IV',
].join('\n');

describe('carryForward', () => {
  const result = carryForward(YESTERDAY, CLEAR);

  it('keeps the headers of cleared sections', () => {
    expect(result.body).toContain('S:');
    expect(result.body).toContain('Penunjang:');
  });

  it('removes the content of cleared sections', () => {
    expect(result.body).not.toContain('sesak berkurang');
    expect(result.body).not.toContain('Hb 10.2');
  });

  it('copies every other section verbatim', () => {
    expect(result.body).toContain('TTV: TD 130/80, N 92');
    expect(result.body).toContain('A: Pneumonia komunitas');
    expect(result.body).toContain('Th/ Ceftriaxone 2x1 g IV');
    expect(result.body).toContain('- Lanjut O2 3 lpm');
  });

  it('keeps the identity line above the first header', () => {
    expect(result.body.startsWith('Tn. B, 52th, Melati 3B')).toBe(true);
  });

  it('reports what it cleared', () => {
    expect(result.cleared).toEqual(['Subjektif', 'Penunjang']);
    expect(result.verbatim).toBe(false);
    expect(carryForwardSummary(result)).toContain('Dikosongkan: Subjektif, Penunjang.');
  });

  it('leaves a blank line under a cleared header, and the next header on its own', () => {
    /*
     * `S:\nO:` was technically correct and unusable — the first thing you do
     * is press Enter to make room. Worse, typing on the line directly beneath
     * a header is how text ends up looking like it belongs to the section
     * after it.
     */
    expect(result.body).toContain('S:\n\nO:');
  });

  it('does not report a section that was already empty', () => {
    const body = 'S:\nA: pneumonia';
    expect(carryForward(body, CLEAR).cleared).toEqual([]);
  });

  it('clears every occurrence of a repeated header', () => {
    const body = 'Penunjang: Hb 10\nA: anemia\nPenunjang: Ur/Cr 30/1.1';
    const cleared = carryForward(body, CLEAR).body;
    expect(cleared).not.toContain('Hb 10');
    expect(cleared).not.toContain('Ur/Cr');
    expect(cleared.match(/Penunjang:/g)).toHaveLength(2);
  });

  it('never clears _intro, even if configured', () => {
    const body = 'Tn. B, 52th\nA: pneumonia';
    const output = carryForward(body, ['_intro', 's'] as SectionId[]).body;
    expect(output).toContain('Tn. B, 52th');
  });

  it('respects a custom clear set', () => {
    const output = carryForward(YESTERDAY, ['terapi'] as SectionId[]);
    expect(output.body).toContain('sesak berkurang');
    expect(output.body).not.toContain('Ceftriaxone');
    expect(output.cleared).toEqual(['Terapi']);
  });
});

describe('carryForward with no detected structure', () => {
  const body = 'pasien membaik, rencana pulang besok';
  const result = carryForward(body, CLEAR);

  it('copies verbatim', () => {
    expect(result.body).toBe(body);
    expect(result.cleared).toEqual([]);
  });

  it('flags that nothing could be cleared, so the UI can warn', () => {
    expect(result.verbatim).toBe(true);
    expect(carryForwardSummary(result)).toContain('periksa kembali data lama');
  });

  it('handles an empty previous body', () => {
    expect(carryForward('', CLEAR)).toEqual({ body: '', cleared: [], verbatim: true });
  });
});

/**
 * Vitals are not a section, and clearing them as one did nothing.
 *
 * Real notes have no `TTV:` heading — the vitals are bare labelled lines under
 * `*O:*`, each parsing as its own custom section. So `ttv` in the cleared list
 * had no section to blank and failed silently, which is the worst way for it
 * to fail: yesterday's blood pressure carried into today's note, looking
 * filled in.
 */
describe('clearing the vital signs', () => {
  const BODY = [
    '*O:*',
    'Compos Mentis GCS (E4V5M6)',
    'Tekanan Darah : 160/83 mmHg',
    'Nadi : 60 kali/menit, reguler',
    'Pernapasan : 18 kali/menit',
    'Suhu : 36.7 derajat Celcius',
    'SpO2 : 97 % on room air',
    '',
    'TB : 155 cm',
    'BB : 60 kg',
  ].join('\n');

  const cleared = carryForward(BODY, ['ttv']).body;

  it('empties the value but keeps the label and the unit', () => {
    expect(cleared).toContain('Tekanan Darah :  mmHg');
    expect(cleared).toContain('Suhu :  derajat Celcius');
    // The words after the number are part of the blank form, not a value.
    expect(cleared).toContain('Nadi :  kali/menit, reguler');
    expect(cleared).toContain('SpO2 : % on room air');
  });

  it('drops every reading', () => {
    for (const stale of ['160/83', '36.7', '97 %', '60 kali', '18 kali']) {
      expect(cleared).not.toContain(stale);
    }
  });

  it('leaves height and weight alone', () => {
    // Not vitals, unchanged between rounds, and read by the konsul formats.
    expect(cleared).toContain('TB : 155 cm');
    expect(cleared).toContain('BB : 60 kg');
  });

  it('leaves the consciousness line alone', () => {
    expect(cleared).toContain('Compos Mentis GCS (E4V5M6)');
  });

  it('reports what it did, so the summary is not silent', () => {
    expect(carryForward(BODY, ['ttv']).cleared).toContain('Tanda vital');
  });

  it('says nothing when the vitals were already blank', () => {
    const blank = carryForward(BODY, ['ttv']).body;
    expect(carryForward(blank, ['ttv']).cleared).not.toContain('Tanda vital');
  });

  it('does not touch the vitals when ttv is not configured', () => {
    expect(carryForward(BODY, ['s']).body).toContain('Tekanan Darah : 160/83 mmHg');
  });
});
