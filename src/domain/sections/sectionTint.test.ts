import { describe, expect, it } from 'vitest';

import { tintFor } from './sectionTint';
import type { SectionId } from '../types';

describe('tintFor', () => {
  it('gives the opening block its own band', () => {
    expect(tintFor('_intro' as SectionId, '')).toBe('identitas');
  });

  it('maps the four SOAP parts', () => {
    expect(tintFor('s' as SectionId, 'Subjektif')).toBe('s');
    expect(tintFor('o' as SectionId, 'Objektif')).toBe('o');
    expect(tintFor('a' as SectionId, 'Assessment')).toBe('a');
    expect(tintFor('p' as SectionId, 'Plan')).toBe('terapi');
    expect(tintFor('terapi' as SectionId, 'Terapi')).toBe('terapi');
  });

  it('puts investigations with O, where they are read', () => {
    for (const label of [
      'EKG PJT Lantai 5 06-08-2026',
      'Laboratorium PJT (04-08-2026)',
      'Foto Thorax 28-07-2026',
      'Echocardiography Bedside',
      'MRI Kontras Cardiac',
    ]) {
      expect(tintFor('custom_x' as SectionId, label)).toBe('o');
    }
  });

  it('puts consultant replies in their own band', () => {
    expect(tintFor('custom_ts_emd' as SectionId, 'TS EMD')).toBe('ts');
    expect(tintFor('custom_k' as SectionId, 'Balasan konsul')).toBe('ts');
  });

  it('reads a diagnosis heading as assessment', () => {
    expect(tintFor('custom_dx' as SectionId, 'Diagnosis Primer')).toBe('a');
    expect(tintFor('custom_p' as SectionId, 'Problem')).toBe('a');
  });

  it('gives no tint to a heading it does not recognise', () => {
    // A wrong band is worse than a plain one: these are read without thinking.
    expect(tintFor('custom_zzz' as SectionId, 'Sesuatu')).toBeNull();
  });

  it('prefers the consultant band over the therapy keywords inside it', () => {
    // "TS EMD" contains no therapy word, but "Balasan konsul terapi" does.
    expect(tintFor('custom_x' as SectionId, 'Balasan konsul terapi')).toBe('ts');
  });
});
