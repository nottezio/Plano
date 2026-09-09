import { describe, expect, it } from 'vitest';

import { sliceGroups } from './sectionSlices';
import { DEFAULT_SECTION_ALIASES as ALIASES } from '../defaults';

/**
 * A real vascular follow-up, which broke "Salin bagian" in two places at once.
 *
 * `A. femoralis: +/-` opened an assessment section — `A` is an alias and `.`
 * was a delimiter — so the pulse findings were copied under `*Diagnosis:*` in a
 * PDF going to a consultant, and the board card summarised the patient as
 * "femoralis: +/-".
 *
 * The parser fix stops `A.` matching. This file guards the other half: the
 * subset is a contiguous slice between boundaries, so an unfamiliar heading —
 * `Pulsasi:`, `6P:`, `Laporan Arteriografi (02-09-2026)` — is carried along
 * inside its block instead of having to be named.
 */
const NOTE = [
  'Assalamualaikum wr wb. Tabe prof, mohon izin melaporkan follow up pasien di *PJT lantai 4 kamar 420 bed 6 atas nama :',
  '',
  '*Tn. Irwan / 04-10-1984 / 41 tahun / RM 1661366*',
  '',
  '_DPJP : Prof. Dr. dr. Idar Mappangara, Sp.PD, FINASIM, Sp.JP(K), FIHA_',
  '',
  '*S:*',
  '- Nyeri pada tungkai kanan disertai kebas.',
  '- BAB dan BAK kesan normal',
  '',
  '*O:*',
  'Compos mentis, GCS E4V5M6.',
  'Tekanan Darah : 135/76 mmhg',
  '',
  '6P:',
  'Pain: +/-',
  'Pulselessness: +/-',
  '',
  'Pulsasi:',
  'A. femoralis: +/-',
  'A. poplitea: -/-',
  'A. dorsalis pedis: -/-',
  '',
  '*Laporan Arteriografi (02-09-2026)*',
  'Kesimpulan: Total Oklusi 100% setinggi Common Femoral Artery Dextra',
  '',
  '*Mohon izin kami assess dengan:*',
  '- Acute on Chronic Limb-Threatening Ischemia (CLTI) Rutherford IIa',
  '- Hypertensive Heart Disease',
  '',
  '*Mohon izin kami terapi dengan:*',
  '- NaCl 0,9% 1.500 cc/24 jam/IV',
  '- Aspilet 80 mg/24 jam/oral',
  '',
  'Selesai:',
  '- Transfusi PRC 4 bag',
  '',
  '*Plan:*',
  '- Monitoring tanda vital dan hemodinamik',
  '- Cek DR Kontrol (Rabu, 09/09/2026)',
  '',
  '*TS EMD*',
  'A/',
  '- DM Type II Non Obese',
  'P/',
  '- Target GDS 140-180 mg/dl',
  '',
  '*TS Anestesi*',
  'A/',
  'Nyeri Somatik akut derajat sedang-berat',
  '',
  'Tabe Prof, mohon arahannya Prof. Terima kasih Prof.',
].join('\n');

const slice = (group: 's' | 'o' | 'a' | 'terapi' | 'plan'): string =>
  sliceGroups(NOTE, ALIASES, [group]);

describe('Salin bagian on a vascular note', () => {
  it('never carries the opening', () => {
    for (const group of ['s', 'o', 'a', 'terapi', 'plan'] as const) {
      const out = slice(group);
      expect(out).not.toContain('Assalamualaikum');
      expect(out).not.toContain('RM 1661366');
      expect(out).not.toContain('Idar Mappangara');
    }
  });

  it('S runs from S to O and no further', () => {
    const out = slice('s');
    expect(out).toContain('Nyeri pada tungkai kanan');
    expect(out).toContain('BAB dan BAK kesan normal');
    expect(out).not.toContain('Compos mentis');
  });

  it('O carries the pulse block, the 6P block and the procedure report', () => {
    // None of these headings is in any vocabulary. They do not need to be.
    const out = slice('o');
    expect(out).toContain('Tekanan Darah : 135/76 mmhg');
    expect(out).toContain('6P:');
    expect(out).toContain('A. femoralis: +/-');
    expect(out).toContain('*Laporan Arteriografi (02-09-2026)*');
    expect(out).toContain('Total Oklusi 100%');
  });

  it('O stops at the assessment', () => {
    expect(slice('o')).not.toContain('Rutherford IIa');
  });

  it('A is the diagnoses, not the pulses', () => {
    /*
     * The bug in the screenshot: `A. femoralis` opened an assessment, so the
     * PDF filed the pulse findings under Diagnosis and the card summary read
     * "femoralis: +/-".
     */
    const out = slice('a');
    expect(out).toContain('Rutherford IIa');
    expect(out).toContain('Hypertensive Heart Disease');
    expect(out).not.toContain('femoralis');
    expect(out).not.toContain('Pulsasi');
  });

  it('Terapi keeps Selesai and the TS replies, and stops before Plan', () => {
    const out = slice('terapi');
    expect(out).toContain('Aspilet 80 mg/24 jam/oral');
    // `Selesai:` is the tail of the therapy block — the note says so by
    // putting it there, and no keyword is needed to know it.
    expect(out).toContain('Selesai:');
    expect(out).toContain('Transfusi PRC 4 bag');
    expect(out).toContain('*TS EMD*');
    expect(out).toContain('*TS Anestesi*');
    expect(out).not.toContain('Monitoring tanda vital');
  });

  it('Plan is ours alone — the TS replies are a boundary', () => {
    /*
     * The consulting services write after `*Plan:*`. Without a boundary at
     * `TS`, copying Plan would paste the anaesthetist's plan and the
     * endocrinologist's insulin orders as if they were ours.
     */
    const out = slice('plan');
    expect(out).toContain('Monitoring tanda vital dan hemodinamik');
    expect(out).toContain('Cek DR Kontrol');
    expect(out).not.toContain('TS EMD');
    expect(out).not.toContain('Target GDS');
  });

  it('preserves the note order and wording exactly', () => {
    // A slice of the original, so nothing is reordered or reworded on the way
    // into a message.
    expect(NOTE).toContain(slice('a'));
  });
});
