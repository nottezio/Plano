import { describe, expect, it } from 'vitest';
import { fitSoapFont, fitTextPt, textFitsAt } from './fit';
import { GEOMETRY, slideHeight } from './geometry';
import { soapColumns } from './soapColumns';

// Synthetic notes, shaped like ward reports; no real patient.
const SYNTH_SOAP = [
  'S :',
  '- Sesak berkurang, nyeri dada tidak ada',
  'O :',
  'Tensi : 120/80 mmHg',
  'Nadi : 80 x/menit',
  'Diagnosis:',
  '- Contoh diagnosis',
  'Terapi:',
  '- Obat contoh 1x1',
  'Plan',
  '- EKG/hari',
].join('\n');

const SYNTH_REPORT_WITH_FRAME = [
  'Selamat pagi dokter, izin melaporkan pasien atas nama:',
  'Tn. Contoh / 54 tahun / RM 1234567',
  '_DPJP Utama : Prof. Contoh_',
  'Chief : dr. A',
  'Junior : dr. B',
  '',
  SYNTH_SOAP,
  '',
  'Selanjutnya mohon arahan dokter. Terima kasih',
].join('\n');

const SYNTH_WITH_KOMORBID = ['S :', '- Lemas', 'Komorbid :', '- Hipertensi', 'O :', 'TD 130/80', 'Diagnosis:', '- Contoh'].join('\n');

describe('soapColumns', () => {
  it('puts S and O in col2 and A/Terapi/Plan in col3, text unchanged', () => {
    const r = soapColumns(SYNTH_SOAP, {});
    expect(r.col2.startsWith('S :')).toBe(true);
    expect(r.col3.startsWith('Diagnosis:')).toBe(true);
    expect(SYNTH_SOAP.includes(r.col2) && SYNTH_SOAP.includes(r.col3)).toBe(true);
    expect(r.col3).toContain('Terapi:');
    expect(r.col3).toContain('- EKG/hari');
  });

  it('drops opening, DPJP/Chief/Junior and closing lines', () => {
    const r = soapColumns(SYNTH_REPORT_WITH_FRAME, { identity: 'Tn. Contoh / 54 tahun / RM 1234567', rm: '1234567' });
    expect(`${r.col2}\n${r.col3}`).not.toMatch(/izin melaporkan|DPJP|Chief|Junior|Terima kasih|RM 1234567/);
    expect(r.col2.startsWith('S :')).toBe(true);
  });

  it('keeps an unfamiliar heading inside its block', () => {
    expect(soapColumns(SYNTH_WITH_KOMORBID, {}).col2).toContain('Komorbid :\n- Hipertensi');
  });

  it('no S boundary: clinical text still lands in col2', () => {
    expect(soapColumns('Pasien baik.\nDiagnosis:\n- CHF', {}).col2).toContain('Pasien baik.');
  });

  it('no A boundary: everything in col2', () => {
    const r = soapColumns('S :\n- sesak\nO :\nTD 120/80', {});
    expect(r.col3).toBe('');
    expect(r.col2).toContain('TD 120/80');
  });

  it('"Mohon izin … assess / terapi dengan" headings read Diagnosis: / Terapi: on the slide', () => {
    const r = soapColumns('S :\n- baik\nMohon izin kami assess dengan :\n- CHF\nMohon izin kami terapi dengan:\n- Furosemid', {});
    expect(r.col3).toBe('Diagnosis:\n- CHF\nTerapi:\n- Furosemid');
  });

  it('text on the same line as a "Mohon izin" heading is kept', () => {
    expect(soapColumns('S :\n- baik\nMohon izin kami assess dengan: CHF', {}).col3).toBe('Diagnosis: CHF');
  });

  it('a Terapi heading without Diagnosis still starts col3', () => {
    expect(soapColumns('S :\n- baik\nTerapi:\n- Obat', {}).col3.startsWith('Terapi:')).toBe(true);
  });
});

describe('fitTextPt (free-text slide shrink-to-fit)', () => {
  const box = GEOMETRY.textOnly;

  it('short text keeps the 24 pt maximum', () => {
    expect(fitTextPt('- baik', box, 24, 8)).toEqual({ pt: 24, overflow: false });
  });

  it('a long report shrinks until it fits, wrapped to the box width', () => {
    const text = Array.from({ length: 40 }, (_, i) => `- Baris ${i} dengan teks panjang `.repeat(2)).join('\n');
    const r = fitTextPt(text, box, 24, 8);
    expect(r.overflow).toBe(false);
    expect(r.pt).toBeLessThan(24);
    expect(textFitsAt(text, box, r.pt)).toBe(true);
  });

  it('flags overflow at the floor', () => {
    expect(fitTextPt('x '.repeat(20000), box, 24, 8)).toEqual({ pt: 8, overflow: true });
  });
});

describe('fitSoapFont', () => {
  it('a long SOAP that overflows a 16:9 slide fits a tall (4:3) one', () => {
    const long = Array.from({ length: 55 }, () => '- baris pendek').join('\n');
    expect(fitSoapFont(long, '').overflow).toBe(true);
    expect(fitSoapFont(long, '', slideHeight(true)).overflow).toBe(false);
  });

  it('short text keeps 10.5 pt', () => {
    expect(fitSoapFont('S :\n- baik', 'Diagnosis:\n- x')).toEqual({ pt: 10.5, overflow: false });
  });

  it('long text stops at 9 pt and flags overflow', () => {
    expect(fitSoapFont('x '.repeat(9000), '')).toEqual({ pt: 9, overflow: true });
  });

  it('text just over 10.5 pt capacity steps down without overflow', () => {
    const lines = Array.from({ length: 42 }, () => '- baris pendek').join('\n');
    const r = fitSoapFont(lines, '');
    expect(r.overflow).toBe(false);
    expect(r.pt).toBeLessThan(10.5);
  });
});
