import { describe, expect, it } from 'vitest';

import { KONSUL_CUSTOM_ID, KONSUL_PRESETS, konsulPresetById } from './konsulPresets';
import { composeKonsul } from './composeKonsul';
import { DEFAULT_SECTION_ALIASES } from '../defaults';
import type { Patient } from '../types';

const PATIENT = {
  id: 'p1',
  name: 'Tn. Basra',
  mrn: '1068190',
  age: 56,
  ward: 'PJT Lantai 5',
  room: '517',
  bed: '3',
  diagnoses: [],
} as unknown as Patient;

const BODY = [
  'Assalamualaikum dokter.',
  'Mohon izin melaporkan pasien di *PJT Lantai 5 Kamar 517 Bed 3* atas nama:',
  '',
  '*Tn. Basra / 12-03-1970 / 56 tahun / RM 1068190*',
  '',
  '_DPJP Kardio: dr. Zaenab Djafar, Sp.JP(K)_',
  '',
  '*Mohon izin kami assess dengan:*',
  '- CHF NYHA II',
  '',
  'TB : 165 cm',
  'BB : 60 kg',
].join('\n');

describe('KONSUL_PRESETS', () => {
  it('carries only the two referrals asked for, plus the free-text escape', () => {
    // The list grows from real referrals. Guessing at others would put wording
    // into a message nobody has ever sent.
    expect(KONSUL_PRESETS.map((preset) => preset.id)).toEqual(['6mwt', 'echo-full']);
    expect(konsulPresetById(KONSUL_CUSTOM_ID)).toBeNull();
  });

  it('keeps the 6MWT wording the free-text default already produced', () => {
    // Switching the control must not silently reword a message in daily use.
    expect(konsulPresetById('6mwt')?.purpose).toBe('6MWT');
  });

  it('chooses the message shape as well as the wording', () => {
    // This is the whole point: echo full study is a numbered line in a shared
    // list, and remembering to tick a separate checkbox for it is the step
    // that was being missed.
    expect(konsulPresetById('6mwt')?.listStyle).toBe(false);
    expect(konsulPresetById('echo-full')?.listStyle).toBe(true);
  });

  it('every preset states its shape in words', () => {
    // A choice made on the user's behalf and left invisible cannot be checked.
    for (const preset of KONSUL_PRESETS) expect(preset.note.trim().length).toBeGreaterThan(0);
  });
});

describe('presets drive composeKonsul', () => {
  const compose = (id: string): string => {
    const preset = konsulPresetById(id)!;
    return composeKonsul(BODY, PATIENT, DEFAULT_SECTION_ALIASES, {
      purpose: preset.purpose,
      listStyle: preset.listStyle,
    });
  };

  it('6MWT composes a letter about one patient', () => {
    const out = compose('6mwt');
    expect(out).toContain('konsul pasien rencana 6MWT');
    expect(out).not.toContain('list pasien');
    // The measurements a 6MWT request is sent back without.
    expect(out).toContain('TB : 165 cm');
    expect(out).toContain('BB : 60 kg');
  });

  it('echo full study composes a numbered list entry', () => {
    const out = compose('echo-full');
    expect(out).toContain('list pasien Echocardiography full study');
    expect(out).toContain('1. *Tn. Basra / 12-03-1970 / 56 tahun / RM 1068190*');
  });
});
