import { describe, expect, it } from 'vitest';

import { labHeading, parseLab } from './parseLab';

/** Transcribed from a real printout, reference ranges and units included. */
const PRINTOUT = `
HEMATOLOGI RUTIN + LED
WBC        23.23    4.00 - 10.0    10^3/ul
RBC        3.70     4.00 - 6.00    10^6/uL
HGB        10.2     12.0 - 16.0    gr/dl
HCT        30.6     37.0 - 48.0    %
MCV        82.7     80.0 - 97.0    fL
MCH        27.5     26.5 - 33.5    pg
MCHC       33.3     31.5 - 35.0    gr/dl
PLT        754      150 - 400      10^3/ul
NEUT       85.5     52.0 - 75.0    %
LYMPH      5.3      20.0 - 40.0    %
LED        112      L (-), P(-)    mm
GDS        246      140            mg/dl
Kreatinin  1.20     L(1.3), P(<1.1)  mg/dl
eGFR       63       >= 90          mL/min/1.73m2
ureum      70       10 - 50        mg/dl
Natrium    130      136 - 145      mmol/l
Kalium     4.6      3.5 - 5.1      mmol/l
Klorida    103      97 - 111       mmol/l
`;

describe('parseLab', () => {
  const result = parseLab(PRINTOUT);

  it('produces the compact handover format', () => {
    expect(result.formatted).toBe(
      [
        'WBC 23.23',
        'RBC 3.70',
        'HGB 10.2',
        'HCT 30.6',
        'MCV/MCH/MCHC 82.7/27.5/33.3',
        'PLT 754',
        'NEUT/LYMPH 85.5/5.3',
        'LED 112',
        'GDS 246',
        'Ur/Cr 70/1.20',
        'eGFR 63',
        'Na/K/Cl 130/4.6/103',
      ].join('\n'),
    );
  });

  it('takes the result, never the reference range', () => {
    // `WBC 23.23  4.00 - 10.0` — taking the last number would report 10.0 as
    // the patient's white count, which reads as plausible. That is the worst
    // kind of wrong.
    expect(result.formatted).toContain('WBC 23.23');
    expect(result.formatted).not.toContain('WBC 4.00');
  });

  it('copies values verbatim, including abnormal ones', () => {
    expect(result.formatted).toContain('PLT 754');
    expect(result.formatted).toContain('HGB 10.2');
  });

  it('recognises Indonesian analyte names', () => {
    expect(parseLab('Natrium 132\nKalium 4.0\nKlorida 104').formatted).toBe('Na/K/Cl 132/4.0/104');
    expect(parseLab('Trombosit 246').formatted).toBe('PLT 246');
    expect(parseLab('Hemoglobin 12.4').formatted).toBe('HGB 12.4');
  });

  it('handles qualitative results without inventing a number', () => {
    const output = parseLab('HBsAg Reactive\nAnti HCV Non Reactive\nAnti HIV Non Reactive').formatted;
    expect(output).toContain('HBsAg Reactive');
    expect(output).toContain('Anti HCV Non Reactive');
    expect(output).toContain('Anti HIV Non Reactive');
  });

  it('emits a partial group rather than dropping it', () => {
    // Only MCV and MCH present: the label names what is actually there.
    expect(parseLab('MCV 97\nMCH 33').formatted).toBe('MCV/MCH 97/33');
  });

  it('keeps unrecognised analytes instead of silently discarding them', () => {
    const output = parseLab('WBC 6.01\nProkalsitonin 0.12').formatted;
    expect(output).toContain('WBC 6.01');
    expect(output).toContain('Lain-lain:');
    expect(output).toContain('Prokalsitonin 0.12');
  });

  it('ignores section headings with no value', () => {
    expect(parseLab('KIMIA DARAH\nElektrolit\nWBC 6.01').formatted).toBe('WBC 6.01');
  });

  it('takes the first occurrence when a name repeats', () => {
    expect(parseLab('HGB 10.2\nHGB 99.9').formatted).toBe('HGB 10.2');
  });

  it('prefers the longer alias', () => {
    expect(parseLab('Anti HCV Non Reactive').known[0]?.key).toBe('Anti HCV');
  });

  it('returns nothing usable for text with no results', () => {
    expect(parseLab('HASIL PEMERIKSAAN LABORATORIUM\nHalaman 1 dari 2').formatted).toBe('');
  });

  it('preserves decimal commas as written', () => {
    expect(parseLab('Albumin 3,3').formatted).toBe('Albumin 3,3');
  });
});

describe('labHeading', () => {
  it('builds the dated block heading', () => {
    expect(labHeading('07-08-2026')).toBe('*Laboratorium (07-08-2026)*');
    expect(labHeading('07-08-2026', 'Laboratorium PJT')).toBe('*Laboratorium PJT (07-08-2026)*');
  });
});
