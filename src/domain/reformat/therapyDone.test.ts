import { describe, expect, it } from 'vitest';

import { normaliseBullets, splitFinishedTherapy } from './therapyDone';

const NOTE = [
  '*Mohon izin kami terapi dengan:*',
  '- IVFD NaCl 0.9% 500 cc/24 jam',
  '- Amlodipin 5 mg/24 jam/oral',
  '- CA Gluconas 10% 30 cc/IV habis dalam 10 menit (selesai)',
  '- Insulin Novorapid 10 IU dalam Dextrose 40% 50 cc/IV (selesai)',
  '',
  'Plan :',
  '- Monitoring tanda vital dan hemodinamik',
].join('\n');

describe('splitFinishedTherapy', () => {
  const result = splitFinishedTherapy(NOTE);

  it('moves the marked drugs into their own block', () => {
    expect(result.moved).toBe(2);
    expect(result.body).toContain('Selesai:\n- CA Gluconas');
  });

  it('drops the marker once the heading says it', () => {
    // Repetition under a heading that already says it is how a heading stops
    // being read.
    expect(result.body).not.toContain('(selesai)');
  });

  it('leaves the active list in its original order', () => {
    const active = result.body.slice(0, result.body.indexOf('Selesai:'));
    expect(active).toContain('- IVFD NaCl');
    expect(active).toContain('- Amlodipin');
    expect(active).not.toContain('CA Gluconas');
  });

  it('keeps everything after the therapy block untouched', () => {
    expect(result.body).toContain('Plan :\n- Monitoring tanda vital');
  });

  it('does nothing when nothing is marked', () => {
    const plain = NOTE.replace(/ \(selesai\)/g, '');
    expect(splitFinishedTherapy(plain)).toMatchObject({ body: plain, moved: 0 });
  });

  it('does nothing when there is no therapy block at all', () => {
    expect(splitFinishedTherapy('S:\n- Nyeri dada tidak ada').moved).toBe(0);
  });

  it('does not stop at a blank line inside the list', () => {
    // Therapy lists in this corpus are written with blank lines between
    // groups; stopping at the first would leave half the list unexamined.
    const spaced = [
      '*Mohon izin kami terapi dengan:*',
      '- Aspilet 80 mg/24 jam/oral',
      '',
      '- Heparin 12 IU/kgbb/jam/SP (selesai)',
      '',
      'Plan :',
    ].join('\n');
    expect(splitFinishedTherapy(spaced).moved).toBe(1);
  });
});

describe('normaliseBullets', () => {
  it('converts the CVCU bullet to a hyphen', () => {
    expect(normaliseBullets('• IVFD NaCl\n• Amlodipin')).toBe('- IVFD NaCl\n- Amlodipin');
  });

  it('keeps the indentation', () => {
    expect(normaliseBullets('  • Nested')).toBe('  - Nested');
  });

  it('leaves a bold marker alone', () => {
    // `*Mohon izin*` is emphasis, not a bullet — it has no space after the
    // asterisk, which is what separates the two.
    expect(normaliseBullets('*Mohon izin kami terapi dengan:*')).toBe(
      '*Mohon izin kami terapi dengan:*',
    );
  });
});
