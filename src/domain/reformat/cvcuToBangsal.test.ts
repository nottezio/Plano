import { describe, expect, it } from 'vitest';

import { cvcuToBangsal } from './cvcuToBangsal';

/** Trimmed from the CVCU note, keeping every shape that matters. */
const CVCU = [
  'Selamat pagi dokter. Tabe, melaporkan Follow Up pasien di *PJT CVCU bed 7* atas nama:',
  '',
  '*Tn. Ardiansa/ 17-01-1987/ 39 thn / RM 01679091*',
  '',
  '_DPJP Utama: dr. Pendrik Tandean, Sp.PD, KKV_',
  '',
  '*S:*',
  '- Saat ini nyeri dada berkurang, sesak sesekali.',
  '',
  '*O:* Compos mentis',
  '',
  '*Airway* : Patent, SpO2 96% on Room Air',
  '',
  '*Breathing* : RR 16 x/menit, Bunyi pernapasan vesikuler, rhonki dan wheezing tidak ada',
  'LUS : Lung sliding (+), A-line (-), B-line (-)',
  '',
  '*Circulation* :',
  'TD 103/73 mmHg , Nadi 94 menit reguler, JVP R+3 cmH2O, BJ I/II murni reguler',
  '',
  'Echocardiography Bedside (16-07-2026)',
  '1. Moderately Abnormal LV systolic function, EF 39.4%',
  '2. Normal RV systolic function, TAPSE 2.1 cm',
  '',
  '*Exposure* :',
  'Suhu 36.7 C',
  '',
  'EKG di CVCU PJT 23-07-2026',
  'Sinus rhythm, HR 92 bpm reguler normoaxis',
  '',
  'Lab PJT (22-07-2026):SGOT/SGPT 112/91',
  '',
  'Mohon izin kami assess dengan:',
  '- STEMI equivalent onset 22 hours KILLIP 1',
].join('\n');

describe('cvcuToBangsal', () => {
  const result = cvcuToBangsal(CVCU);

  it('leaves everything above O untouched', () => {
    expect(result.body).toContain('*Tn. Ardiansa/ 17-01-1987/ 39 thn / RM 01679091*');
    expect(result.body).toContain('_DPJP Utama: dr. Pendrik Tandean, Sp.PD, KKV_');
    expect(result.body).toContain('- Saat ini nyeri dada berkurang, sesak sesekali.');
  });

  it('leaves everything from A onward untouched', () => {
    expect(result.body).toContain('Mohon izin kami assess dengan:');
    expect(result.body).toContain('- STEMI equivalent onset 22 hours KILLIP 1');
  });

  it('drops the organ-system headers, which are layout and not findings', () => {
    expect(result.body).not.toContain('*Airway*');
    expect(result.body).not.toContain('*Breathing*');
    expect(result.body).not.toContain('*Circulation*');
    expect(result.body).not.toContain('*Exposure*');
  });

  it('collects the vitals above the examination', () => {
    const body = result.body;
    expect(body.indexOf('Suhu 36.7 C')).toBeLessThan(body.indexOf('EKG di CVCU'));
    expect(result.summary.vitals).toBeGreaterThanOrEqual(2);
  });

  it('moves every investigation below the examination', () => {
    const body = result.body;
    const firstInvestigation = Math.min(
      body.indexOf('Echocardiography Bedside'),
      body.indexOf('EKG di CVCU'),
      body.indexOf('Lab PJT'),
    );
    expect(firstInvestigation).toBeGreaterThan(body.indexOf('*O:* Compos mentis'));
    expect(result.summary.investigations).toBeGreaterThanOrEqual(3);
  });

  it('keeps a multi-line report attached to its heading', () => {
    const body = result.body;
    expect(body.indexOf('1. Moderately Abnormal LV systolic function')).toBeGreaterThan(
      body.indexOf('Echocardiography Bedside'),
    );
    expect(body.indexOf('2. Normal RV systolic function')).toBeGreaterThan(
      body.indexOf('1. Moderately Abnormal LV systolic function'),
    );
  });

  it('loses no content at all', () => {
    // The rule the whole function exists under: a reformatter that drops a
    // finding is worse than none, because the note still looks complete.
    const meaningful = CVCU.split('\n')
      .map((line) => line.replace(/^\s*\*?\s*(Airway|Breathing|Circulation|Exposure)\s*\*?\s*:?\s*/i, ''))
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !/^\*(Airway|Breathing|Circulation|Exposure)\*/.test(line));

    for (const line of meaningful) {
      expect(result.body).toContain(line);
    }
  });

  it('returns the note untouched when there is no O section', () => {
    const noO = '*S:*\n- nyeri dada tidak ada';
    expect(cvcuToBangsal(noO).body).toBe(noO);
  });

  it('is idempotent — reformatting a bangsal note changes nothing important', () => {
    const once = cvcuToBangsal(CVCU).body;
    const twice = cvcuToBangsal(once).body;
    expect(twice).toBe(once);
  });

  it('reports what it did, so the user can check rather than trust', () => {
    expect(result.summary.vitals).toBeGreaterThan(0);
    expect(result.summary.investigations).toBeGreaterThan(0);
    expect(typeof result.summary.unrecognised).toBe('number');
  });
});
