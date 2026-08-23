import { describe, expect, it } from 'vitest';

import { cvcuToBangsal } from './cvcuToBangsal';

/** The CVCU note from the worked pair, trimmed to the shapes that matter. */
const CVCU = [
  'Assalamualaikum prof, melaporkan Pasien di *CVCU VIP 1*, pasien atas nama:',
  '',
  '*Ny. Nirwana / 20-01-1967 / 59 tahun / RM 854003*',
  '',
  'S/',
  'Saat ini Keluhan nyeri dada, berdebar dan sesak napas tidak ada.',
  '',
  'O/',
  'Airway: Patent.',
  '',
  'Breathing: RR 20 x/menit, SpO₂ 96% via room air, BP vesikuler, ronkhi (-), wheezing (-).',
  '',
  'Circulation: TD 121/84 mmHg, nadi 80 x/menit reguler, BJ I/II murni reguler, murmur (-), JVP R+2 cmH₂O, edema ekstremitas (-), akral hangat, CTR <2 detik.',
  '',
  'Disability: GCS E4V5M6, compos mentis.',
  '',
  'Exposure: Suhu 36.4°C.',
  '',
  'EKG',
  'EKG CVCU PJT (19-08-2026)',
  'Sinus Rhtym, 83 bpm, reguler, normoaxis.',
  '',
  'Laboratorium RS PJT 18-08-2026',
  'ApTT 31.4',
  '',
  'Foto Thorax (17-08-2026)',
  'Slight cardiomegaly',
  '',
  'Mohon izin kami assess dengan:',
  '- Unstable Angina Pectoris Low Risk',
].join('\n');

describe('cvcuToBangsal', () => {
  const result = cvcuToBangsal(CVCU);
  const body = result.body;

  it('lifts vitals out of the organ-system sentences', () => {
    // The part the header-unwrapping version could not do: these are buried
    // mid-sentence in `Circulation: TD 121/84 mmHg, nadi 80 ...`.
    expect(body).toContain('Tekanan Darah : 121/84 mmHg');
    expect(body).toContain('Nadi : 80 x/menit reguler');
    expect(body).toContain('Pernapasan : 20 x/menit');
    expect(body).toContain('Suhu : 36.4°C');
    expect(body).toContain('SpO2 : 96% via room air');
  });

  it('puts them in the ward order, above the examination', () => {
    const order = ['Tekanan Darah', 'Nadi', 'Pernapasan', 'Suhu', 'SpO2'];
    const positions = order.map((label) => body.indexOf(label));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(body.indexOf('SpO2')).toBeLessThan(body.indexOf('JVP'));
  });

  it('keeps the examination findings', () => {
    // Fragments are capitalised, since each becomes its own line.
    for (const finding of ['JVP R+2', 'BJ I/II murni reguler', 'Akral hangat']) {
      expect(body).toContain(finding);
    }
  });

  it('drops the organ-system labels', () => {
    for (const header of ['Airway:', 'Breathing:', 'Circulation:', 'Disability:', 'Exposure:']) {
      expect(body).not.toContain(header);
    }
  });

  it('moves investigations below and gives each a heading', () => {
    expect(body).toContain('*EKG CVCU PJT (19-08-2026)*');
    expect(body).toContain('*Laboratorium RS PJT 18-08-2026*');
    expect(body).toContain('*Foto Thorax (17-08-2026)*');
    expect(body.indexOf('*EKG CVCU')).toBeGreaterThan(body.indexOf('JVP'));
  });

  it('drops the bare `EKG` label that only introduced the block', () => {
    expect(body).not.toMatch(/^EKG$/m);
    expect(body).toContain('Sinus Rhtym, 83 bpm');
  });

  it('leaves everything outside O untouched', () => {
    expect(body).toContain('*Ny. Nirwana / 20-01-1967 / 59 tahun / RM 854003*');
    expect(body).toContain('Saat ini Keluhan nyeri dada');
    expect(body).toContain('- Unstable Angina Pectoris Low Risk');
  });

  it('reports what it did', () => {
    expect(result.summary.vitals).toBeGreaterThanOrEqual(5);
    expect(result.summary.investigations).toBe(3);
  });

  it('does nothing to a note already in bangsal form', () => {
    const bangsal = [
      '*O:*',
      'Compos mentis',
      'Tekanan Darah : 118/64 mmHg',
      '',
      '*A:*',
      '- x',
    ].join('\n');
    expect(cvcuToBangsal(bangsal).summary.investigations).toBe(0);
  });

  it('returns the note untouched when there is no O section', () => {
    const noO = '*S:*\n- nyeri dada tidak ada';
    expect(cvcuToBangsal(noO).body).toBe(noO);
  });
});
