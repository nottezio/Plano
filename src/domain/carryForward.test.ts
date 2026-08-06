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

  it('leaves the following header on its own line', () => {
    expect(result.body).toContain('S:\nO:');
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
