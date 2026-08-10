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

describe('OCR noise', () => {
  it('does not present garbled text as a lab value', () => {
    // Verbatim from a failed OCR run on a lab screenshot.
    expect(parseLab('Nara pre Tog oT 13550').formatted).toBe('');
  });

  it('still keeps a genuine two-word analyte', () => {
    expect(parseLab('Asam urat 7.2').formatted).toContain('Asam urat 7.2');
  });

  it('keeps a three-word analyte', () => {
    expect(parseLab('Total protein serum 6.8').formatted).toContain('Total protein serum 6.8');
  });

  it('rejects a sentence that happens to contain a number', () => {
    expect(
      parseLab('Hasil ini hanya berlaku untuk sampel yang diterima 2026').formatted,
    ).toBe('');
  });
});

describe('text extracted from a lab PDF', () => {
  /** Exactly as the PDF text layer yields it, header and footer included. */
  const PDF_TEXT = `
HASIL PEMERIKSAAN LABORATORIUM
No. RM : 01661366
Nama : IRWAN
Sex / Tgl Lahir : Laki-Laki / 04-10-1984
No. Lab : 1011601062608100068
Diagnosa : ACLI
No. Registrasi 2608032053
Tgl. Hasil 10/08/2026 12:58:20
PEMERIKSAAN HASIL NILAI RUJUKAN SATUAN
HEMATOLOGI
Hematologi Rutin
HEMATOLOGI RUTIN + LED
WBC 5.98 4.00 - 10.0 10^3/ul
RBC 4.16 4.00 - 6.00 10^6/uL
HGB 12.3 12.0 - 16.0 gr/dl
HCT 37.1 37.0 - 48.0 %
MCV 89.1 80.0 - 97.0 fL
MCH 29.5 26.5 - 33.5
MCHC 33.2 31.5 - 35.0 gr/dl
PLT 386 150 - 400 10^3/ul
RDW-SD 40.1 37.0 - 54.0 fL
RDW-CV 12.8 10.0 - 15.0 %
PDW 15.8 10.0 - 18.0 fL
MPV 8.0 6.50 - 11.0 fL
PCT 0.310 0.15 - 0.50 %
NEUT 64.0 52.0 - 75.0 %
LYMPH 26.6 20.0 - 40.0 %
MONO 6.1 2.00 - 8.00 %
EO 3.1 1.00 - 3.00 %
BASO 0.2 0.00 - 0.10 %
LED 38 (L <10, P <20 ) mm
NRBC% 0.000 0.00 - 0.05 /100 WBC
Koagulasi
APTT/PTTK
APTT 31.4 22.0 - 30.0 detik
KIMIA DARAH
Elektrolit
ELEKTROLIT DARAH (NA, K, CL)
Natrium 135 136 - 145 mmol/l
Kalium 3.7 3.5 - 5.1 mmol/l
Klorida 105 97 - 111 mmol/l
Kesan / Saran : Pemanjangan masa hemostasis faktor ekstrinsik
Halaman 1 dari 2
`;

  const result = parseLab(PDF_TEXT);

  it('produces exactly the handover lines', () => {
    expect(result.formatted).toBe(
      [
        'WBC 5.98',
        'RBC 4.16',
        'HGB 12.3',
        'HCT 37.1',
        'MCV/MCH/MCHC 89.1/29.5/33.2',
        'PLT 386',
        'NEUT/LYMPH 64.0/26.6',
        'LED 38',
        'APTT 31.4',
        'Na/K/Cl 135/3.7/105',
      ].join('\n'),
    );
  });

  it('reports APTT alone when INR and PT are absent', () => {
    expect(result.formatted).toContain('APTT 31.4');
    expect(result.formatted).not.toContain('APTT/INR/PT');
  });

  it('drops the patient header, not just the page footer', () => {
    expect(result.formatted).not.toContain('01661366');
    expect(result.formatted).not.toContain('2608032053');
    expect(result.formatted).not.toContain('IRWAN');
  });

  it('leaves no Lain-lain section for a clean report', () => {
    expect(result.formatted).not.toContain('Lain-lain');
    expect(result.unknown).toHaveLength(0);
  });
});

describe('recognised but not reported', () => {
  it('omits routine indices instead of burying real findings under them', () => {
    const output = parseLab(
      [
        'WBC 5.98',
        'RDW-SD 40.1',
        'RDW-CV 12.8',
        'PDW 15.8',
        'MPV 8.0',
        'PCT 0.310',
        'MONO 6.1',
        'EO 3.1',
        'BASO 0.2',
        'NRBC% 0.000',
        'Prokalsitonin 0.12',
      ].join('\n'),
    ).formatted;

    expect(output).toContain('WBC 5.98');
    // The one genuinely unfamiliar test is visible, not eighth in a list.
    expect(output).toContain('Prokalsitonin 0.12');
    expect(output).not.toContain('RDW');
    expect(output).not.toContain('MONO');
    expect(output).not.toContain('BASO');
  });
});
