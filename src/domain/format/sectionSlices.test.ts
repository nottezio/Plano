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

describe('leaving out a block\'s heading (28 Oct 2026)', () => {
  it('drops the bare heading line of the chosen block, nothing else', () => {
    expect(sliceGroups(NOTE, ALIASES, ['a'])).toBe('*Mohon izin kami assess dengan:*\n- Congestive Heart Failure NYHA IV');
    expect(sliceGroups(NOTE, ALIASES, ['a'], { dropHeaders: true })).toBe('- Congestive Heart Failure NYHA IV');
    expect(sliceGroups(NOTE, ALIASES, ['plan'], { dropHeaders: true })).toBe('- Monitoring tanda vital\n- Cek INR/3 hari');
  });

  it('keeps sub-headings and consultant blocks inside a block', () => {
    const terapi = sliceGroups(NOTE, ALIASES, ['terapi'], { dropHeaders: true });
    expect(terapi.startsWith('- Furosemide 40 mg/12 jam/IV')).toBe(true);
    expect(terapi).toContain('*TS GEH*');
    expect(terapi).toContain('*Plan Diagnostik*');
  });

  it('several blocks each lose their own heading', () => {
    expect(sliceGroups(NOTE, ALIASES, ['a', 'plan'], { dropHeaders: true })).toBe(
      '- Congestive Heart Failure NYHA IV\n\n- Monitoring tanda vital\n- Cek INR/3 hari',
    );
  });

  it('leaves a first line that is content', () => {
    expect(sliceGroups('S: Sesak berkurang\n- BAB', ALIASES, ['s'], { dropHeaders: true })).toBe('S: Sesak berkurang\n- BAB');
    expect(sliceGroups('*A:*\n- DM', ALIASES, ['a'], { dropHeaders: true })).toBe('- DM');
    expect(sliceGroups('', ALIASES, ['a'], { dropHeaders: true })).toBe('');
  });

  it('drops a heading with no colon, as the parser reads it (2026-10-28, Visite bug)', () => {
    const note = '*Mohon izin kami assest dengan*\n- HHD\n\nMohon izin kami terapi dengan\n- Furosemide\n\nPlan\n- Echo';
    expect(sliceGroups(note, ALIASES, ['a'], { dropHeaders: true })).toBe('- HHD');
    expect(sliceGroups(note, ALIASES, ['terapi'], { dropHeaders: true })).toBe('- Furosemide');
    expect(sliceGroups(note, ALIASES, ['plan'], { dropHeaders: true })).toBe('- Echo');
  });

  it('never drops the kardiologi conclusion sentence, which is the assessment itself', () => {
    const note = '*Saat ini evaluasi Kardiologi berdasarkan anamnesis, pasien kami assess dengan ACS*\n- Low risk';
    expect(sliceGroups(note, ALIASES, ['a'], { dropHeaders: true })).toContain('Saat ini evaluasi Kardiologi');
  });
});
