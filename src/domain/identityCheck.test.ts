import { describe, expect, it } from 'vitest';

import { checkIdentity } from './identityCheck';
import { makePatient } from './testFactories';
import type { Patient } from './types';

const patient = (over: Partial<Patient>): Patient => ({ ...makePatient({}), ...over });

const noteFor = (line: string): string =>
  ['melaporkan pasien di *PJT Lt 5 Kamar 501* atas nama:', line, '', '*S:*', '- x'].join('\n');

describe('checkIdentity', () => {
  it('matches when the record number agrees', () => {
    const result = checkIdentity(
      patient({ name: 'Tn. Budi', mrn: '1234567' }),
      noteFor('*Tn. Budi / 52 tahun / RM 1234567*'),
    );
    expect(result.status).toBe('match');
  });

  it('catches the copy that goes to the wrong patient', () => {
    // The whole point: this message reads as a coherent report about somebody,
    // just not the patient whose chart is open.
    const result = checkIdentity(
      patient({ name: 'Tn. Budi', mrn: '1234567' }),
      noteFor('*Ny. Siti / 66 tahun / RM 9999999*'),
    );
    expect(result.status).toBe('mismatch');
    if (result.status !== 'mismatch') return;
    expect(result.field).toBe('mrn');
    expect(result.noteValue).toBe('9999999');
    expect(result.recordValue).toBe('1234567');
  });

  it('ignores a leading zero, which is written inconsistently', () => {
    const result = checkIdentity(
      patient({ mrn: '1679091' }),
      noteFor('*Tn. A / 39 thn / RM 01679091*'),
    );
    expect(result.status).toBe('match');
  });

  it('falls back to the name when there is no record number', () => {
    expect(
      checkIdentity(patient({ name: 'Tn. Budi Santoso' }), noteFor('*Tn. Budi Santoso / 52 tahun / RM 1*'))
        .status,
    ).toBe('match');
  });

  it('accepts a shortened name against a fuller one', () => {
    // The record often holds less than the note spells out.
    expect(
      checkIdentity(patient({ name: 'Tn. Budi' }), noteFor('*Tn. Budi Santoso / 52 tahun / RM 1*'))
        .status,
    ).toBe('match');
  });

  it('ignores honorifics and punctuation', () => {
    expect(
      checkIdentity(patient({ name: 'Budi Santoso' }), noteFor('*Tn. BUDI SANTOSO / 52 th / RM 1*'))
        .status,
    ).toBe('match');
  });

  it('says nothing when there is nothing to compare', () => {
    // Silence, not a warning: an unfilled record is the normal state of a new
    // patient, and warning there would train the warning away.
    // A brand-new patient: no name, no record number on the record itself.
    expect(
      checkIdentity(patient({ name: '' }), noteFor('*Tn. Budi / 52 tahun / RM 1234567*'))
        .status,
    ).toBe('unknown');
    expect(checkIdentity(patient({ mrn: '123456' }), '*S:*\n- x').status).toBe('unknown');
  });
});
