import { describe, expect, it } from 'vitest';

import { DEFAULT_SECTION_ALIASES as ALIASES } from '../defaults';
import { sliceGroups } from './sectionSlices';

/*
  The shape of a 9 October transfer note (anonymised): our plan, then two TS
  replies with their own A/, Th/, P/ and "Plan Diagnostik / Plan Monitoring".
*/
const NOTE = [
  'Tabe dokter mohon izin melaporkan pasien atas nama :',
  '',
  '*Tn. Contoh / 01-01-1980 / 46 tahun / RM 1234567*',
  '',
  '*Mohon izin kami assess dengan:*',
  '- Congestive Heart Failure NYHA IV',
  '',
  '*Mohon izin kami terapi dengan:*',
  '- Furosemide 40 mg/12 jam/IV',
  '',
  'Plan:',
  '- Monitoring tanda vital',
  '- Cek INR/3 hari',
  '',
  '*TS GEH*',
  'A/',
  '- Ascites Grade 2',
  'Th/',
  '- Spironolacton 50 mg/24 jam/oral',
  'P/',
  '*Plan Diagnostik*',
  '- Aspirasi cairan asites',
  '*Plan Monitoring*',
  '- Monitoring Keadaan Umum',
  '',
  '*TS HOM*',
  'A/',
  '- Susp Trombositosis',
  'P/',
  '*Plan Diagnostik*',
  '- BMP Jika KU optimal',
  '',
  'TS KGEH',
  'Assesment :',
  '- Melena',
  'Planning :',
  '- Diet Lunak',
].join('\n');

describe('a TS reply is one block (2026-10-10)', () => {
  it('keeps the TS plans inside "Terapi + TS"', () => {
    const terapi = sliceGroups(NOTE, ALIASES, ['terapi']);
    expect(terapi).toContain('- Furosemide 40 mg/12 jam/IV');
    expect(terapi).toContain('*Plan Diagnostik*\n- Aspirasi cairan asites');
    expect(terapi).toContain('- BMP Jika KU optimal');
    expect(terapi).toContain('Planning :\n- Diet Lunak');
  });

  it('keeps Plan to our own plan', () => {
    const plan = sliceGroups(NOTE, ALIASES, ['plan']);
    expect(plan).toBe('Plan:\n- Monitoring tanda vital\n- Cek INR/3 hari');
  });

  it('keeps A to our own assessment', () => {
    expect(sliceGroups(NOTE, ALIASES, ['a'])).toBe('*Mohon izin kami assess dengan:*\n- Congestive Heart Failure NYHA IV');
  });

  it('lets our own heading end a TS block written in the middle of the note', () => {
    const middle = [
      '*Mohon izin kami assess dengan:*',
      '- CHF',
      '',
      '*TS Pulmo*',
      'A/',
      '- Efusi pleura',
      'P/',
      '- Torakosintesis',
      '',
      '*Mohon izin kami terapi dengan:*',
      '- Furosemide',
      '',
      'Plan:',
      '- Echo',
    ].join('\n');
    expect(sliceGroups(middle, ALIASES, ['plan'])).toBe('Plan:\n- Echo');
    expect(sliceGroups(middle, ALIASES, ['terapi'])).toContain('- Torakosintesis');
    expect(sliceGroups(middle, ALIASES, ['terapi'])).toContain('- Furosemide');
  });
});
