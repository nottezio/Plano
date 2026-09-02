import { describe, expect, it } from 'vitest';

import { parseLab } from './parseLab';

/**
 * Bolding abnormal values.
 *
 * The ranges come from the PRINTOUT, never from a table in this app. Reference
 * ranges differ by laboratory, analyser, age and sex, and a value flagged
 * against a range this hospital does not use is worse than no flag at all.
 */
const SHEET = [
  'URINALISIS (AUTOMATIK)',
  'Ph', '6.0', '4.5 - 8.0',
  'Bj', '1.045', '1.005 - 1.035',
  'Sedimen Eritrosit', '9', '< 5', 'lpb',
  'Rasio Albumin Creatinin', '>=300', '0 - 30', 'mg/gCr',
].join('\n');

describe('abnormal lab values', () => {
  it('flags a value outside the printed range', () => {
    const result = parseLab(SHEET);
    expect(result.known.find((v) => v.key === 'Urin BJ')?.abnormal).toBe(true);
  });

  it('does not flag a value inside it', () => {
    const result = parseLab(SHEET);
    expect(result.known.find((v) => v.key === 'Urin pH')?.abnormal).toBe(false);
  });

  it('leaves the question open when no range was printed', () => {
    // `undefined`, not `false`. Nothing may be called normal on the strength
    // of the app failing to read a range.
    const result = parseLab('URINALISIS (AUTOMATIK)\nWarna\nKuning\nKuning Muda');
    expect(result.known.find((v) => v.key === 'Urin Warna')?.abnormal).toBeUndefined();
  });

  it('leaves a one-sided range alone', () => {
    // `< 5` is written inconsistently enough that a misparse would flag a
    // normal result, and a wrong bold is a clinician looking twice at nothing.
    const result = parseLab(SHEET);
    expect(result.known.find((v) => v.key === 'Sedimen Eritrosit')?.abnormal).toBeUndefined();
  });

  it('does not try to compare a value that is not a number', () => {
    const result = parseLab(SHEET);
    expect(
      result.known.find((v) => v.key === 'Rasio Albumin Kreatinin')?.abnormal,
    ).toBeUndefined();
  });

  it('bolds nothing unless asked', () => {
    expect(parseLab(SHEET).formatted).not.toContain('*');
  });

  it('bolds only the value, and only the flagged one', () => {
    const out = parseLab(SHEET, { boldAbnormal: true }).formatted;
    expect(out).toContain('BJ *1.045*');
    // The label is never wrapped: an asterisk before an analyte name reads as
    // a bullet.
    expect(out).not.toContain('*BJ');
    expect(out).toContain('pH 6.0');
  });

  it('never bolds a value with no printed range', () => {
    const out = parseLab('URINALISIS (AUTOMATIK)\nWarna\nKuning\nKuning Muda', {
      boldAbnormal: true,
    }).formatted;
    expect(out).not.toContain('*');
  });
});
