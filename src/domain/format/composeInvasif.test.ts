import { describe, expect, it } from 'vitest';

import { composeInvasif } from './composeInvasif';
import { DEFAULT_SECTION_ALIASES as ALIASES } from '../defaults';
import { makePatient } from '../testFactories';

const PATIENT = makePatient({
  name: 'Tn. Mansyur Lahman',
  mrn: '1701549',
  age: 68,
  ward: 'IGD PJT',
  bed: 'Redzoned 6',
});

const BODY = [
  '*Tn. Mansyur Lahman/05-05-1958/68 tahun/RM 1701549*',
  '',
  '_DPJP Utama dan Tindakan : dr. Az Hafid Nashar, SpJP(K)_',
  '',
  '*S :*',
  '- Nyeri dada.',
  '',
  '*Mohon izin kami assess dengan*',
  '- Unstable Angina Pectoris High Risk (GRACE Score 86 Points)',
  '- Coronary Artery Disease 3 Vessels Disease dengan aneurismatik LAD dan RCA',
  '',
  '*Mohon izin kami terapi dengan*',
  '- Aspilet 80 mg',
  '',
  'TB : 157 cm',
  'BB : 65 kg',
].join('\n');

const OPTIONS = {
  procedure: 'Advanced PCI',
  scheduledFor: 'Minggu, 16-08-2026',
  payer: 'BPJS Kelas I',
};

describe('composeInvasif', () => {
  const out = composeInvasif(BODY, PATIENT, ALIASES, OPTIONS);

  it('opens with the rencana tindakan sentence and the location', () => {
    expect(out).toContain('mohon izin melaporkan rencana tindakan dari *IGD PJT Bed Redzoned 6*');
  });

  it("reuses the note's own identity line", () => {
    expect(out).toContain('*Tn. Mansyur Lahman/05-05-1958/68 tahun/RM 1701549*');
  });

  it('carries the DPJP line as written', () => {
    expect(out).toContain('_DPJP Utama dan Tindakan : dr. Az Hafid Nashar, SpJP(K)_');
  });

  it('copies the assessment verbatim under Diagnosis', () => {
    expect(out).toContain('*Diagnosis :*');
    expect(out).toContain('- Coronary Artery Disease 3 Vessels Disease dengan aneurismatik LAD dan RCA');
  });

  it('puts the procedure and its date on one emphasised line', () => {
    // The single fact the group reads this message for.
    expect(out).toContain('*Rencana Tindakan : Advanced PCI (Minggu, 16-08-2026)*');
  });

  it('lists BB above TB, then the payer', () => {
    expect(out).toContain('BB : 65 kg\nTB : 157 cm\nBPJS Kelas I');
  });

  it('takes nothing from therapy', () => {
    expect(out).not.toContain('Aspilet');
  });

  it('ends with the closing', () => {
    expect(out.trimEnd().endsWith('Mohon ijin mengirimkan pemeriksaan penunjang pasien dokter.')).toBe(true);
  });

  it('omits the date when none is given rather than writing empty brackets', () => {
    const out2 = composeInvasif(BODY, PATIENT, ALIASES, { procedure: 'Advanced PCI' });
    expect(out2).toContain('*Rencana Tindakan : Advanced PCI*');
    expect(out2).not.toContain('()');
  });

  it('omits the payer line for a patient who is not BPJS', () => {
    const out2 = composeInvasif(BODY, PATIENT, ALIASES, { procedure: 'PCI' });
    expect(out2).not.toContain('BPJS');
    expect(out2).toContain('BB : 65 kg');
  });

  it('takes our assessment, not a TS block\u2019s', () => {
    const withTs = [
      '*Mohon izin kami assess dengan*',
      '- milik kami',
      '',
      '*TS BTKV*',
      '*A/*',
      '- milik TS',
    ].join('\n');
    const result = composeInvasif(withTs, PATIENT, ALIASES, OPTIONS);
    expect(result).toContain('- milik kami');
    expect(result).not.toContain('milik TS');
  });

  it('leaves no gap where an absent block would have been', () => {
    const bare = '*Mohon izin kami assess dengan*\n- CHF';
    expect(composeInvasif(bare, PATIENT, ALIASES, OPTIONS)).not.toMatch(/\n{3,}/);
  });
});

/**
 * The longer "laporan" form, from the sample Avicenna supplied on 2026-09-02.
 *
 * Same message with the investigations attached. The short form ends by asking
 * permission to send them; this one is that follow-up, so it carries them and
 * signs off differently.
 */
const WITH_PENUNJANG = [
  BODY,
  '',
  '*Echocardiography Bedside (15-08-2026)*',
  '1. Normal LV systolic function, EF 55.2%',
  '',
  '*EKG IGD PJT (15-08-2026)*',
  'Sinus rhythm, HR 65 bpm, reguler, LAD',
  '',
  '*Laboratorium PJT (15-08-2026)*',
  'WBC : 5.650',
  'Ur/Cr : 23/0.48 (eGFR : 173)',
  '',
  '*Foto Thorax PJT (15-08-2026)*',
  '_menunggu hasil_',
].join('\n');

describe('composeInvasif with investigations', () => {
  const out = composeInvasif(WITH_PENUNJANG, PATIENT, ALIASES, {
    ...OPTIONS,
    includeInvestigations: true,
  });

  it('carries the investigation blocks', () => {
    expect(out).toContain('*EKG IGD PJT (15-08-2026)*');
    expect(out).toContain('*Laboratorium PJT (15-08-2026)*');
    expect(out).toContain('*Foto Thorax PJT (15-08-2026)*');
    expect(out).toContain('*Echocardiography Bedside (15-08-2026)*');
  });

  it('orders them EKG, lab, film, echo regardless of note order', () => {
    // The note stores them in whatever order they arrived; the group reads
    // them in one order.
    const ekg = out.indexOf('*EKG IGD PJT');
    const lab = out.indexOf('*Laboratorium PJT');
    const foto = out.indexOf('*Foto Thorax PJT');
    const echo = out.indexOf('*Echocardiography Bedside');
    expect(ekg).toBeLessThan(lab);
    expect(lab).toBeLessThan(foto);
    expect(foto).toBeLessThan(echo);
  });

  it('does not mistake a value line inside a lab block for a block', () => {
    // `Ur/Cr : 23/0.48` is a field. It must stay under its lab heading.
    expect(out).toContain('*Laboratorium PJT (15-08-2026)*\nWBC : 5.650\nUr/Cr : 23/0.48 (eGFR : 173)');
  });

  it('signs off as the follow-up, not as the request', () => {
    expect(out.trimEnd().endsWith('Tabe terima kasih dokter.')).toBe(true);
    expect(out).not.toContain('Mohon ijin mengirimkan pemeriksaan penunjang');
  });

  it('still leads with diagnosis and the procedure line', () => {
    const diagnosis = out.indexOf('*Diagnosis :*');
    const tindakan = out.indexOf('*Rencana Tindakan :');
    const ekg = out.indexOf('*EKG IGD PJT');
    expect(diagnosis).toBeLessThan(tindakan);
    expect(tindakan).toBeLessThan(ekg);
  });

  it('omits them entirely in the short form', () => {
    const short = composeInvasif(WITH_PENUNJANG, PATIENT, ALIASES, OPTIONS);
    expect(short).not.toContain('*EKG IGD PJT');
    expect(short.trimEnd().endsWith('Mohon ijin mengirimkan pemeriksaan penunjang pasien dokter.')).toBe(true);
  });
});
