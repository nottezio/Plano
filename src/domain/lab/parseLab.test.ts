import { describe, expect, it } from 'vitest';

import { insertIntoObjective, labHeading, parseLab } from './parseLab';
import { parseSections } from '../sections/parseSections';
import { DEFAULT_SECTION_ALIASES as ALIASES } from '../sections/aliases';

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
        'Ur/Cr 70/1.20 (eGFR 63)',
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

describe('insertIntoObjective', () => {
  const body = [
    'Pembuka di sini.',
    '',
    '*S:*',
    '- nyeri (-)',
    '',
    '*O:*',
    'TD 116/72',
    '',
    '*EKG 06-08*',
    'Sinus',
    '',
    '*A:*',
    '- CAD',
    '',
    '*Plan :*',
    '- Monitoring',
  ].join('\n');

  /** Real offsets from the real parser, not hand-written ones. */
  const boundaries = (text: string) =>
    parseSections(text, ALIASES).map((section) => ({
      sectionId: section.sectionId,
      start: section.start,
      end: section.end,
    }));

  it('lands after the investigation stack, before A', () => {
    const out = insertIntoObjective(body, '*Lab (10-08)*\nHGB 12.3', boundaries(body));
    expect(out.indexOf('Lab (10-08)')).toBeGreaterThan(out.indexOf('EKG 06-08'));
    expect(out.indexOf('Lab (10-08)')).toBeLessThan(out.indexOf('*A:*'));
  });

  it('never lands after Plan', () => {
    const out = insertIntoObjective(body, '*Lab*\nHGB 12.3', boundaries(body));
    expect(out.indexOf('*Lab*')).toBeLessThan(out.indexOf('*Plan :*'));
  });

  it('appends when the note has no objective section', () => {
    const thin = '*S:*\n- nyeri (-)';
    const out = insertIntoObjective(thin, '*Lab*\nHGB 12.3', boundaries(thin));
    expect(out.endsWith('*Lab*\nHGB 12.3')).toBe(true);
  });

  it('handles an empty note', () => {
    expect(insertIntoObjective('', '*Lab*\nHGB 12.3', [])).toBe('*Lab*\nHGB 12.3');
  });

  it('loses no existing text', () => {
    const out = insertIntoObjective(body, '*Lab*\nHGB 12.3', boundaries(body));
    for (const fragment of ['nyeri (-)', 'TD 116/72', 'Sinus', '- CAD', '- Monitoring']) {
      expect(out).toContain(fragment);
    }
  });

  it('stacks a second lab below the first', () => {
    const once = insertIntoObjective(body, '*Lab (09-08)*\nHGB 12.0', boundaries(body));
    const twice = insertIntoObjective(once, '*Lab (10-08)*\nHGB 12.3', boundaries(once));
    expect(twice.indexOf('Lab (10-08)')).toBeGreaterThan(twice.indexOf('Lab (09-08)'));
    expect(twice.indexOf('Lab (10-08)')).toBeLessThan(twice.indexOf('*A:*'));
  });
});

describe('the compact lab format as written in a report', () => {
  /** Verbatim from a konsul kelayakan note — already in handover shorthand. */
  const WRITTEN = [
    '*Hasil Pemeriksaan Laboratorium PJT 06/08/2026*',
    'WBC: 5.08',
    'Hb: 12.8',
    'HCT: 39.0',
    'PLT: 252000',
    'APTT/INR/PT: 27.0/0.91/9.5',
    'GDS: 66',
    'Ur/Cr: 30/0.73',
    'GOT/GPT: 40/38',
    'Na/K/Cl: 141/4.4/103',
    'HBsAg Non Reactive',
    'Anti HCV Non Reactive',
    'Anti HIV Non Reactive',
  ].join('\n');

  const result = parseLab(WRITTEN);

  it('reads a note that is already in the output format', () => {
    // Re-parsing your own output has to be lossless, or pasting a previous
    // day's block back in would quietly drop values.
    expect(result.formatted).toContain('WBC 5.08');
    expect(result.formatted).toContain('HGB 12.8');
    expect(result.formatted).toContain('HCT 39.0');
    expect(result.formatted).toContain('PLT 252000');
    expect(result.formatted).toContain('GDS 66');
  });

  it('splits a combined line into its analytes', () => {
    expect(result.formatted).toContain('APTT/INR/PT 27.0/0.91/9.5');
    expect(result.formatted).toContain('Ur/Cr 30/0.73');
    expect(result.formatted).toContain('GOT/GPT 40/38');
    expect(result.formatted).toContain('Na/K/Cl 141/4.4/103');
  });

  it('keeps the serology results as written', () => {
    expect(result.formatted).toContain('HBsAg Non Reactive');
    expect(result.formatted).toContain('Anti HCV Non Reactive');
    expect(result.formatted).toContain('Anti HIV Non Reactive');
  });

  it('leaves no Lain-lain for a note in this format', () => {
    expect(result.formatted).not.toContain('Lain-lain');
  });
});

describe('the panels in the real lab PDFs', () => {
  /** From the printout text layer, as pdfjs returns it. */
  const AGD = [
    'ANALISA GAS DARAH',
    'PH 7.472 7.35 - 7.45',
    'PO2 132.3 80.0 - 100.0 mmHg',
    'PCO2 25.1 35.0 - 45.0 mmHg',
    'SO2 99.6 95 - 98 %',
    'HCO3 18.5 22 - 26 mmol/l',
    'BE -5.3 - 2 s/d +2 mmol/l',
    'ctO2 19.8 15.8 - 22.3',
    'ctCO2 19.3 23 - 27 mmol/l',
  ].join('\n');

  it('prints a blood gas as a blood gas, not as loose lines', () => {
    // Eight values that mean nothing apart. They used to land in "Lain-lain",
    // which lost the fact that they are one measurement.
    const out = parseLab(AGD).formatted;
    expect(out).toContain('Analisa Gas Darah :');
    expect(out).toContain('pH 7.472');
    expect(out).toContain('PCO2 25.1');
    expect(out).toContain('HCO3 18.5');
    expect(out).not.toContain('Lain-lain');
  });

  it('takes the result, not the reference range, inside a panel', () => {
    expect(parseLab(AGD).formatted).toContain('SO2 99.6');
    expect(parseLab(AGD).formatted).not.toContain('SO2 95');
  });

  it('groups a urinalysis under its own heading', () => {
    const urin = [
      'URINALISIS (AUTOMATIK)',
      'Warna Kuning Kuning Muda',
      'Ph 5.5 4.5 - 8.0',
      'Bj 1.030 1.005 - 1.035',
      'Protein Negatif Negatif mg/dl',
      'Urobilinogen 1+ Normal mg/dl',
    ].join('\n');
    const out = parseLab(urin).formatted;
    expect(out).toContain('Urinalisis :');
    expect(out).toContain('BJ 1.030');
  });

  it('writes eGFR beside Ur/Cr, as the notes do', () => {
    const renal = 'ureum 31 10 - 50 mg/dl\nKreatinin 1.25\neGFR 64 >= 90';
    expect(parseLab(renal).formatted).toContain('Ur/Cr 31/1.25 (eGFR 64)');
  });

  it('keeps the blood group', () => {
    expect(parseLab('Golongan darah B Rh+').formatted).toContain('Golongan darah');
  });

  it('reads a full haematology printout without a Lain-lain section', () => {
    const cbc = [
      'WBC 7.24 4.00 - 10.0 10^3/ul',
      'RBC 4.62 4.00 - 6.00 10^6/uL',
      'HGB 14.1 12.0 - 16.0 gr/dl',
      'HCT 42.4 37.0 - 48.0 %',
      'MCV 91.8 80.0 - 97.0 fL',
      'MCH 30.4 26.5 - 33.5',
      'MCHC 33.3 31.5 - 35.0 gr/dl',
      'PLT 170 150 - 400 10^3/ul',
      'NEUT 59.3 52.0 - 75.0 %',
      'LYMPH 32.3 20.0 - 40.0 %',
      'LED 10 (L <10, P <20 ) mm',
    ].join('\n');
    const out = parseLab(cbc).formatted;
    expect(out).toContain('MCV/MCH/MCHC 91.8/30.4/33.3');
    expect(out).toContain('NEUT/LYMPH 59.3/32.3');
    expect(out).not.toContain('Lain-lain');
  });
});

/**
 * The urinalysis printout, verbatim from the hospital's own PDF text layer.
 *
 * Its table extracts one CELL per line — `Warna` \n `Kuning` \n `Kuning Muda`
 * — not one row per line. Everything below was broken by that layout at once,
 * and each failure was silent: the rows simply did not appear, which reads
 * exactly like a lab that did not run the test.
 */
describe('urinalysis printout, one cell per line', () => {
  const RAW = [
    'HASIL PEMERIKSAAN LABORATORIUM',
    'PEMERIKSAAN', 'HASIL', 'NILAI RUJUKAN', 'SATUAN',
    'URINALISA', 'Urinalysa', 'URINALISIS (AUTOMATIK)',
    'Warna', 'Kuning', 'Kuning Muda',
    'Ph', '6.0', '4.5 - 8.0',
    'Bj', '1.029', '1.005 - 1.035',
    'Protein', '1+', 'Negatif', 'mg/dl',
    'Glukose', '3+', 'Negatif', 'mg/dl',
    'Bilirubine', 'Negatif', 'Negatif', 'mg/dl',
    'Urobilinogen', '1+', 'Normal', 'mg/dl',
    'Keton', 'Negatif', 'Negatif', 'mg/dl',
    'Nitrit', 'Negatif', 'Negatif', 'mg/dl',
    'Blood', 'Negatif', 'Negatif', 'RBC/ ul',
    'Lekosit', 'Negatif', 'Negatif', 'WBC/ul',
    'Vit, C', 'Negatif', 'Negatif', 'mg/dl',
    'Sedimen Eritrosit', '2', '< 5', 'lpb',
    'sedimen Kristal', '0', 'lpk',
    'Sedimen Epitel Sel', '0', 'lpk',
    'Sedimen Lain - lain', 'BAC=2', 'ul',
    'Sedimen Lekosit', '1', '< 5', 'lpb',
    'Sedimen Torak', '0', 'lpk',
    'Rasio Albumin Creatinin', '>=300', '0 - 30', 'mg/gCr',
    'Rasio Protein Creatinin', '>=0.50', '0 - 0.15', 'g/gCr',
    'Kesan / Saran', ': Proteinuria, Glukosuria, Urobilinuria',
  ].join('\n');

  const result = parseLab(RAW);

  it('reads a value that sits on the line below its label', () => {
    expect(result.formatted).toContain('Warna Kuning');
    expect(result.formatted).toContain('BJ 1.029');
  });

  it('reads labels whose punctuation is collapsed by normalisation', () => {
    // `Vit, C` -> `vit c` and `Sedimen Lain - lain` -> `sedimen lain lain`.
    // Slicing the raw line by the normalised alias length left `C` and `in`
    // behind, which suppressed the next-line lookahead and lost both rows.
    expect(result.formatted).toContain('Vit C Negatif');
    expect(result.formatted).toContain('Sedimen Lain-lain BAC=2');
  });

  it('keeps the grading on a graded result', () => {
    // `1+` is not `1`. The numeric pattern would return the digit alone, and
    // the difference between 1+ and 3+ protein is the finding.
    expect(result.formatted).toContain('Protein 1+');
    expect(result.formatted).toContain('Glukosa 3+');
    expect(result.formatted).toContain('Urobilinogen 1+');
  });

  it('keeps a comparison operator on a value', () => {
    // `>=300` is not `300` — one says past the top of the scale.
    expect(result.formatted).toContain('Rasio Albumin Kreatinin >=300');
    expect(result.formatted).toContain('Rasio Protein Kreatinin >=0.50');
  });

  it('reads urine pH as urine, not blood gas', () => {
    // Both panels write a bare `Ph`. Only the section heading tells them
    // apart, so the urinalysis pH used to be filed under Analisa Gas Darah.
    expect(result.formatted).toContain('Urinalisis :');
    expect(result.formatted).toContain('pH 6.0');
    expect(result.formatted).not.toContain('Analisa Gas Darah');
  });

  it('files no reference range as a finding', () => {
    // `Kuning Muda` and the bare `Negatif` ranges are the NORMAL values, not
    // results. They were landing in "Lain-lain" as unrecognised findings.
    expect(result.unknown).toEqual([]);
    // The heading, not the substring: `Sedimen Lain-lain` is a real analyte
    // and contains the same text.
    expect(result.formatted).not.toContain('\nLain-lain:');
    expect(result.formatted).not.toContain('Kuning Muda');
  });

  it('reads every row on the sheet', () => {
    for (const label of [
      'Warna', 'pH', 'BJ', 'Protein', 'Glukosa', 'Bilirubin', 'Urobilinogen',
      'Keton', 'Nitrit', 'Blood', 'Leukosit', 'Vit C', 'Sedimen Eritrosit',
      'Sedimen Kristal', 'Sedimen Epitel', 'Sedimen Lain-lain', 'Sedimen Leukosit',
      'Sedimen Torak', 'Rasio Albumin Kreatinin', 'Rasio Protein Kreatinin',
    ]) {
      expect(result.formatted).toContain(label);
    }
  });
});
