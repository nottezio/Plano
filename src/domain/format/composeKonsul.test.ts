import { describe, expect, it } from 'vitest';

import { composeKonsul } from './composeKonsul';
import { DEFAULT_SECTION_ALIASES as ALIASES } from '../defaults';
import { makePatient } from '../testFactories';

const PATIENT = makePatient({
  name: 'Tn. Muh. Djasmani Djafar',
  mrn: '134048',
  age: 53,
  ward: 'PJT Lt. 4',
  room: '402',
});

/** Verbatim shape of the bangsal note this referral is composed from. */
const BODY = [
  'Assalamualaikum dokter, Tabe dokter, mohon izin melaporkan follow up pasien.',
  '',
  '*Tn. Muh. Djasmani Djafar/01-02-1973/53 tahun/RM 134048*',
  '',
  '_DPJP Kardio: dr. Aussie Fitriani Ghaznawie, Sp.JP, Subsp.Eko(K)_',
  '_DPJP Tindakan: Dr. dr. Akhtar Fajar Muzakkir, Sp.JP, Subsp.IKKV(K), KI(K)_',
  '',
  '*S:*',
  '- Nyeri dada ada berkurang.',
  '',
  '*O:*',
  'Compos Mentis',
  'Tekanan Darah : 137/95 mmHg',
  '',
  'TB : 160 cm',
  'BB : 78 kg',
  '',
  '*Mohon izin kami assess dengan:*',
  '- Unstable Angina Pectoris (GRACE Score 53 points)',
  '- Heart Failure mildly reduced Ejection Fraction',
  '- Hypertensive Heart Disase',
  '',
  '*Mohon izin kami terapi dengan:*',
  '- Aspilet 80 mg/24 jam/oral',
  '',
  '*Plan:*',
  '- Monitoring Tanda vital',
].join('\n');

describe('composeKonsul', () => {
  const out = composeKonsul(BODY, PATIENT, ALIASES, { purpose: '6MWT' });

  it('names the purpose and the location in the opening', () => {
    expect(out).toContain('Mohon izin mengirimkan konsul pasien rencana 6MWT');
    expect(out).toContain('*PJT Lt. 4 Kamar 402*');
  });

  it("reuses the note's own identity line, date of birth and all", () => {
    // Rebuilt from the patient record it would lose the DOB, which the record
    // does not always hold and a referral needs.
    expect(out).toContain('*Tn. Muh. Djasmani Djafar/01-02-1973/53 tahun/RM 134048*');
  });

  it('carries every DPJP line, in order', () => {
    const kardio = out.indexOf('_DPJP Kardio:');
    const tindakan = out.indexOf('_DPJP Tindakan:');
    expect(kardio).toBeGreaterThan(-1);
    expect(tindakan).toBeGreaterThan(kardio);
  });

  it('copies the assessment verbatim under a Diagnosis heading', () => {
    expect(out).toContain('*Diagnosis:*');
    expect(out).toContain('- Unstable Angina Pectoris (GRACE Score 53 points)');
    expect(out).toContain('- Heart Failure mildly reduced Ejection Fraction');
    expect(out).toContain('- Hypertensive Heart Disase');
  });

  it('does not reword the assessment', () => {
    // A referral that paraphrases the assessment is a referral that disagrees
    // with the chart. The typo in "Disase" is in the note and stays.
    expect(out).toContain('Hypertensive Heart Disase');
  });

  it('carries height and weight', () => {
    expect(out).toContain('TB : 160 cm');
    expect(out).toContain('BB : 78 kg');
  });

  it('takes nothing from the therapy or plan sections', () => {
    expect(out).not.toContain('Aspilet');
    expect(out).not.toContain('Monitoring Tanda vital');
  });

  it('ends with the closing', () => {
    expect(out.trimEnd().endsWith('mohon arahan ta dokter.')).toBe(true);
  });

  it('takes our assessment, not a TS block\u2019s', () => {
    const withTs = [
      '*Mohon izin kami assess dengan:*',
      '- milik kami',
      '',
      '*TS BTKV*',
      '*A/*',
      '- milik TS',
    ].join('\n');
    const result = composeKonsul(withTs, PATIENT, ALIASES, { purpose: '6MWT' });
    expect(result).toContain('- milik kami');
    expect(result).not.toContain('milik TS');
  });

  it('leaves no gap where an absent block would have been', () => {
    const bare = '*Mohon izin kami assess dengan:*\n- CHF';
    const result = composeKonsul(bare, PATIENT, ALIASES, { purpose: 'Echo' });
    expect(result).not.toMatch(/\n{3,}/);
  });

  it('still composes when the note has no assessment yet', () => {
    const result = composeKonsul('*S:*\n- sesak', PATIENT, ALIASES, { purpose: '6MWT' });
    expect(result).toContain('konsul pasien rencana 6MWT');
    expect(result).not.toContain('*Diagnosis:*');
  });
});

/**
 * The "list pasien" shape — the echo full-study request.
 *
 * One entry in a list several residents add to, not a letter about a single
 * patient. Same body, different framing, which is why it is a flag on this
 * composer rather than a second one that would drift from it.
 */
describe('composeKonsul list style', () => {
  const out = composeKonsul(BODY, PATIENT, ALIASES, {
    purpose: 'Echocardiography full study',
    listStyle: true,
    listFrom: 'PJT Lt. 4',
    listDate: 'Senin, 31-08-2026',
  });

  it('opens with the list sentence, not the referral one', () => {
    expect(out).toContain('mohon izin mengirimkan list pasien Echocardiography full study');
    expect(out).toContain('dari PJT Lt. 4, Senin, 31-08-2026');
    expect(out).not.toContain('konsul pasien rencana');
  });

  it('numbers the patient', () => {
    expect(out).toContain('1. *Tn. Muh. Djasmani Djafar');
  });

  it('keeps the DPJP and diagnosis blocks identical to a referral', () => {
    expect(out).toContain('_DPJP Kardio:');
    expect(out).toContain('*Diagnosis:*');
    expect(out).toContain('- Unstable Angina Pectoris (GRACE Score 53 points)');
  });

  it('uses the shorter closing', () => {
    expect(out.trimEnd().endsWith('Tabe terima kasih dokter')).toBe(true);
  });
});
