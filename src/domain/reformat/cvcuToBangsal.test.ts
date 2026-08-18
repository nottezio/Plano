import { describe, expect, it } from 'vitest';

import { cvcuToBangsal } from './cvcuToBangsal';

const CVCU = [
  'Selamat pagi dokter. Tabe, melaporkan Follow Up pasien di *PJT CVCU bed 7* atas nama:',
  '',
  '*Tn. Ardiansa/ 17-01-1987/ 39 thn / RM 01679091*',
  '',
  '*S:*',
  '- Saat ini nyeri dada berkurang.',
  '',
  '*O:* Compos mentis',
  '',
  '*Airway* : Patent, SpO2 96% on Room Air',
  '',
  '*Breathing* : RR 16 x/menit, Bunyi pernapasan vesikuler',
  'LUS : Lung sliding (+), A-line (-)',
  '',
  '*Circulation* :',
  'TD 103/73 mmHg , Nadi 94 menit reguler, JVP R+3 cmH2O',
  '',
  'Echocardiography Bedside (16-07-2026)',
  '1. Moderately Abnormal LV systolic function, EF 39.4%',
  '',
  '*Exposure* :',
  'Suhu 36.7 C',
  '',
  'EKG di CVCU PJT 23-07-2026',
  'Sinus rhythm, HR 92 bpm',
  '',
  'Mohon izin kami assess dengan:',
  '- STEMI equivalent onset 22 hours KILLIP 1',
].join('\n');

describe('cvcuToBangsal', () => {
  const result = cvcuToBangsal(CVCU);

  it('removes the organ-system headers', () => {
    for (const header of ['*Airway*', '*Breathing*', '*Circulation*', '*Exposure*']) {
      expect(result.body).not.toContain(header);
    }
    expect(result.removed).toHaveLength(4);
  });

  it('keeps a finding written on the same line as its header', () => {
    expect(result.body).toContain('Patent, SpO2 96% on Room Air');
    expect(result.body).toContain('RR 16 x/menit, Bunyi pernapasan vesikuler');
  });

  it('changes nothing else — every other line survives verbatim', () => {
    const untouched = CVCU.split('\n').filter(
      (line) => !/^\s*\*?(Airway|Breathing|Circulation|Exposure)/i.test(line.trim()),
    );
    for (const line of untouched) {
      if (line.trim().length === 0) continue;
      expect(result.body).toContain(line.trim());
    }
  });

  it('preserves the original order', () => {
    const body = result.body;
    // Reordering is what broke notes: the fix is that nothing moves.
    expect(body.indexOf('Patent, SpO2 96%')).toBeLessThan(body.indexOf('LUS :'));
    expect(body.indexOf('LUS :')).toBeLessThan(body.indexOf('TD 103/73'));
    expect(body.indexOf('TD 103/73')).toBeLessThan(body.indexOf('Echocardiography Bedside'));
    expect(body.indexOf('Echocardiography Bedside')).toBeLessThan(body.indexOf('Suhu 36.7 C'));
    expect(body.indexOf('Suhu 36.7 C')).toBeLessThan(body.indexOf('EKG di CVCU'));
  });

  it('leaves everything outside the O section alone', () => {
    expect(result.body).toContain('*Tn. Ardiansa/ 17-01-1987/ 39 thn / RM 01679091*');
    expect(result.body).toContain('- Saat ini nyeri dada berkurang.');
    expect(result.body).toContain('- STEMI equivalent onset 22 hours KILLIP 1');
  });

  it('does not unwrap a system word outside the O section', () => {
    // `Infection` and `Fluid` are ordinary words; unwrapping one in the therapy
    // list would silently edit a finding.
    const note = '*O:*\nSuhu 36.7\n\n*A:*\n- Infection: suspek pneumonia';
    expect(cvcuToBangsal(note).body).toContain('- Infection: suspek pneumonia');
  });

  it('returns the note untouched when there is no O section', () => {
    const noO = '*S:*\n- nyeri dada tidak ada';
    expect(cvcuToBangsal(noO).body).toBe(noO);
  });

  it('does nothing to a note already in bangsal form', () => {
    const bangsal = '*O:* Compos mentis\nTD 88/64 mmHg\nNadi 92 kali/menit\n\n*A:*\n- x';
    expect(cvcuToBangsal(bangsal).body).toBe(bangsal);
    expect(cvcuToBangsal(bangsal).removed).toEqual([]);
  });

  it('is idempotent', () => {
    const once = cvcuToBangsal(CVCU).body;
    expect(cvcuToBangsal(once).body).toBe(once);
  });

  it('does not leave a double blank where a header stood alone', () => {
    expect(result.body).not.toMatch(/\n{3,}/);
  });
});
