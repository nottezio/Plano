import { describe, expect, it } from 'vitest';

import { addressIn, isClosingLine, noteAddress, toDokterForm, toProfForm } from './address';

const NOTE = [
  "Assalamu'alaikum dokter. Tabe dokter, mohon izin melaporkan konsul pasien dari *TS Bedah (Prof. dr. Contoh Satu, Sp.B)*",
  '',
  '*Tn. Contoh / 60 tahun / RM 000001*',
  '',
  '_DPJP Utama : Prof. Dr. dr. Contoh Dua, Sp.JP(K)_',
  '',
  '*Plan:*',
  '- Konsul dokter anestesi',
  '- Lapor Prof besok pagi',
  '',
  'Selanjutnya mohon arahan dokter. Terima kasih dokter',
].join('\n');

describe('toProfForm / toDokterForm', () => {
  it('swaps the address in the opening and the closing only', () => {
    const prof = toProfForm(NOTE);
    expect(prof).toContain("Assalamu'alaikum prof. Tabe prof, mohon izin");
    expect(prof).toContain('Selanjutnya mohon arahan prof. Terima kasih prof');
    // Titles, DPJP lines and the clinical body are never touched.
    expect(prof).toContain('(Prof. dr. Contoh Satu, Sp.B)');
    expect(prof).toContain('_DPJP Utama : Prof. Dr. dr. Contoh Dua, Sp.JP(K)_');
    expect(prof).toContain('- Konsul dokter anestesi');
  });

  it('going back leaves every Prof title as it was (the reported bug)', () => {
    const back = toDokterForm(toProfForm(NOTE));
    expect(back).toBe(NOTE);
    expect(back).not.toContain('dokter. dr.');
    expect(back).not.toContain('dokter. Dr.');
    expect(back).toContain('- Lapor Prof besok pagi');
  });

  it('preserves case and capitalises at a sentence start', () => {
    expect(toProfForm('Dokter yang terhormat')).toBe('Prof yang terhormat');
    expect(toDokterForm('Prof, mohon izin melaporkan')).toBe('Dokter, mohon izin melaporkan');
    expect(toDokterForm('Selamat pagi prof. Terima kasih prof')).toBe('Selamat pagi dokter. Terima kasih dokter');
  });

  it('leaves dr. and Dr. alone', () => {
    const dpjp = '_DPJP Utama : Dr. dr. Contoh Tiga, Sp.JP(K)_';
    expect(toProfForm(dpjp)).toBe(dpjp);
  });
});

describe('noteAddress', () => {
  it('reads the vocative, not a Prof title in the opening line', () => {
    expect(noteAddress(NOTE)).toBe('dokter');
  });

  it('prefers the closing over the opening', () => {
    expect(noteAddress('Tabe dokter, melaporkan\n\n*A:*\n- CHF\n\nTerima kasih Prof')).toBe('Prof');
  });

  it('falls back to dokter when nothing addresses anyone', () => {
    expect(noteAddress('*A:*\n- CHF')).toBe('dokter');
  });

  it('addressIn ignores DPJP lines and titles', () => {
    expect(addressIn('_DPJP : Prof. dr. X_')).toBeNull();
    expect(addressIn('Tabe Prof, izin')).toBe('Prof');
  });
});

describe('isClosingLine', () => {
  it('is a sign-off, never a bulleted plan item', () => {
    expect(isClosingLine('Mohon arahan dokter, terima kasih')).toBe(true);
    expect(isClosingLine('- Mohon arahan DPJP')).toBe(false);
    expect(isClosingLine('- Lapor Prof besok pagi')).toBe(false);
  });
});
