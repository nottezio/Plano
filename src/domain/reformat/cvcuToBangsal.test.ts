import { describe, expect, it } from 'vitest';

import { cvcuToBangsal, lostTokens, splitFindings } from './cvcuToBangsal';

/** The CVCU note from the worked pair, trimmed to the shapes that matter. */
const CVCU = [
  'Assalamualaikum prof, melaporkan Pasien di *CVCU VIP 1*, pasien atas nama:',
  '',
  '*Ny. Nurlela / 20-01-1967 / 59 tahun / RM 800015*',
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
    // Grouped by system, so `akral hangat` now shares a line with the edema
    // finding rather than standing alone.
    for (const finding of ['JVP R+2', 'BJ I/II murni reguler', 'akral hangat']) {
      expect(body).toContain(finding);
    }
  });

  it('loses nothing from the worked example', () => {
    expect(result.lost).toEqual([]);
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
    expect(body).toContain('*Ny. Nurlela / 20-01-1967 / 59 tahun / RM 800015*');
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

describe('the examination is grouped, not one fragment per line', () => {
  const note = [
    '*O:*',
    'Circulation: TD 120/79 mmHg, nadi 90 x/menit irreguler, JVP R+3 cmH20, BJ I/II murni irreguler, murmur sistolik grade IV/VI, edema ekstremitas tidak ada, akral hangat',
    'Breathing: RR 20 x/menit, BP Vesikuler, ronkhi minimal di basal bilateral, wheezing tidak ada',
    'Exposure: Suhu 36.6, anemis tidak ada, ikterus tidak ada',
    '',
    '*A:*',
    '- x',
  ].join('\n');

  const body = cvcuToBangsal(note).body;

  it('joins each system onto one line, in ward order', () => {
    // Eight one-line entries is not how anyone reads an examination.
    expect(body).toContain('Anemis tidak ada, ikterus tidak ada');
    expect(body).toContain('JVP R+3 cmH20');
    expect(body).toContain('BJ I/II murni irreguler, murmur sistolik grade IV/VI');
    expect(body).toContain('BP Vesikuler, ronkhi minimal di basal bilateral, wheezing tidak ada');
    expect(body).toContain('Edema ekstremitas tidak ada, akral hangat');
  });

  it('puts them in the order a bangsal note is read', () => {
    const order = ['Anemis', 'JVP', 'BJ I/II', 'BP Vesikuler', 'Edema'];
    const positions = order.map((label) => body.indexOf(label));
    expect(positions.every((value) => value > -1)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('still lifts the vitals out above them', () => {
    expect(body.indexOf('Tekanan Darah :')).toBeLessThan(body.indexOf('Anemis'));
    expect(body).toContain('Suhu : 36.6');
  });
});

/**
 * 2026-10-05 — "dangerously wrong". Every case here changed or dropped a
 * value before the fix, without anything on screen saying so.
 */
describe('cvcuToBangsal never alters or drops a value', () => {
  const NOTE = [
    '*O :*',
    'Airway: Patent, terpasang NRM 10 lpm',
    'Breathing: RR 24 x/menit, SpO2 94% NRM 10 lpm, sesak nafas berkurang, BP vesikuler, ronkhi basah halus +/+ basal',
    'Circulation: TD 90/60 mmHg (NE 0,1 mcg/kgBB/menit), nadi 112 x/menit ireguler, HR monitor 130, BJ I/II ireguler, akral dingin, CRT 3 detik',
    'Disability: GCS E4V5M6, compos mentis',
    'Exposure: Suhu 37,8 C',
    'Fluid: Balance cairan -500 ml/24 jam, UO 0,5 ml/kgBB/jam',
    'Kalium 3,1; Natrium 132',
    '',
    'EKG CVCU (03-10-2026)',
    'AF RVR, HR 130',
    '',
    '*Mohon izin kami assess dengan*',
    '- Syok kardiogenik',
  ].join('\n');
  const result = cvcuToBangsal(NOTE);

  it('keeps decimal commas whole', () => {
    expect(result.body).toContain('Suhu : 37,8 C');
    expect(result.body).toContain('UO 0,5 ml/kgBB/jam');
    expect(result.body).toContain('Kalium 3,1; Natrium 132');
  });

  it('keeps a parenthesised qualifier with its finding', () => {
    expect(result.body).toContain('Tekanan Darah : 90/60 mmHg (NE 0,1 mcg/kgBB/menit)');
  });

  it('keeps a second reading of a vital instead of dropping it', () => {
    expect(result.body).toContain('Nadi : 112 x/menit ireguler');
    expect(result.body).toContain('HR monitor 130');
  });

  it('does not read a symptom as a vital', () => {
    expect(result.body).toContain('Pernapasan : 24 x/menit');
    expect(result.body).toContain('sesak nafas berkurang');
  });

  it('keeps consciousness on one line', () => {
    expect(result.body).toContain('GCS E4V5M6, compos mentis');
  });

  it('loses no word or number at all', () => {
    expect(result.lost).toEqual([]);
  });
});

describe('lostTokens / splitFindings', () => {
  it('reports a changed number and a dropped word', () => {
    expect(lostTokens('Suhu 37,8 C, akral dingin', 'Suhu : 37 C, akral')).toEqual(['37,8', 'dingin']);
  });

  it('allows the renamed labels and removed headers', () => {
    expect(lostTokens('Circulation: TD 120/80 mmHg', 'Tekanan Darah : 120/80 mmHg')).toEqual([]);
  });

  it('splits on commas between findings only', () => {
    expect(splitFindings('Suhu 36,5 C, nadi 80 (reguler, kuat); RR 20')).toEqual([
      'Suhu 36,5 C',
      'nadi 80 (reguler, kuat)',
      'RR 20',
    ]);
  });
});
