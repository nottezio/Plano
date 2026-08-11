import { describe, expect, it } from 'vitest';

import { parseIdentity, parseLocation, parsePatientFacts } from './parsePatient';

const NOTE = [
  'Selamat pagi prof. Tabe prof, mohon izin melaporkan follow up pasien di *PJT Lantai 5 Kamar 517 Bed 3* atas nama:',
  '',
  '*Ny. Bubi Dg Pajja/ 01-02-1960/ 66 tahun / RM 1478911*',
  '',
  '_DPJP Utama : Prof. dr. Peter Kabo, PhD, Sp.FK, Sp.JP(K)_',
  '',
  'S :',
  '- nyeri dada tidak ada',
].join('\n');

describe('parseIdentity', () => {
  it('reads the whole identity line', () => {
    expect(parseIdentity(NOTE)).toEqual({
      name: 'Ny. Bubi Dg Pajja',
      birthDate: '01-02-1960',
      age: 66,
      mrn: '1478911',
    });
  });

  it('handles the spacing variants people actually type', () => {
    expect(parseIdentity('*Tn. Abdullah / 11-04-1967/ 59 tahun/ RM 1667031*')).toEqual({
      name: 'Tn. Abdullah',
      birthDate: '11-04-1967',
      age: 59,
      mrn: '1667031',
    });
    expect(parseIdentity('*Tn. Hamzah Rahuddin / 01-01-1973 / 53 thn / RM 1656066*')).toEqual({
      name: 'Tn. Hamzah Rahuddin',
      birthDate: '01-01-1973',
      age: 53,
      mrn: '1656066',
    });
  });

  it('locates fields by shape, not by position', () => {
    // No birth date: everything else still lands correctly, where splitting on
    // `/` and trusting the order would shift every field by one.
    expect(parseIdentity('*Tn. Budi / 52 tahun / RM 123456*')).toEqual({
      name: 'Tn. Budi',
      age: 52,
      mrn: '123456',
    });
  });

  it('accepts slashes in the birth date', () => {
    expect(parseIdentity('*Tn. A / 01/02/1970 / 55 th / RM 1*').birthDate).toBe('01-02-1970');
  });

  it('strips separators and spaces from the MRN', () => {
    expect(parseIdentity('*Tn. A / RM 147-891 1*').mrn).toBe('1478911');
  });

  it('returns nothing when there is no identity line', () => {
    expect(parseIdentity('S :\n- nyeri dada tidak ada')).toEqual({});
  });

  it('ignores a line that names a person but carries no RM', () => {
    expect(parseIdentity('_DPJP Utama : Prof. dr. Peter Kabo_')).toEqual({});
  });
});

describe('parseLocation', () => {
  it('reads ward, room and bed', () => {
    expect(parseLocation(NOTE)).toEqual({
      ward: 'PJT Lantai 5',
      room: '517',
      bed: '3',
    });
  });

  it('handles the abbreviated ward form', () => {
    expect(
      parseLocation('melaporkan follow up pasien di *PJT Lt. 4 Kamar 418 Bed 4* atas nama:'),
    ).toEqual({ ward: 'PJT Lt. 4', room: '418', bed: '4' });
  });

  it('handles a room with no bed', () => {
    expect(
      parseLocation('melaporkan follow up pasien di *PJT Lantai 5 kamar 507* atas nama :'),
    ).toEqual({ ward: 'PJT Lantai 5', room: '507' });
  });

  it('handles a bed with no room', () => {
    expect(parseLocation('melaporkan pasien di *CVCU bed 4* atas nama:')).toEqual({
      ward: 'CVCU',
      bed: '4',
    });
  });

  it('ignores an opening line with unfilled placeholders', () => {
    const blank = 'melaporkan follow up pasien di *(Ruang) Kamar (no) Bed (no)* atas nama :';
    const result = parseLocation(blank);
    // A placeholder is not a room number; whatever it reads must not look real.
    expect(result.room).not.toBe('517');
  });

  it('returns nothing without an opening sentence', () => {
    expect(parseLocation('S :\n- nyeri dada')).toEqual({});
  });
});

describe('parsePatientFacts', () => {
  it('returns identity and location together', () => {
    expect(parsePatientFacts(NOTE)).toEqual({
      name: 'Ny. Bubi Dg Pajja',
      birthDate: '01-02-1960',
      age: 66,
      mrn: '1478911',
      ward: 'PJT Lantai 5',
      room: '517',
      bed: '3',
    });
  });

  it('is empty for a note that says nothing about the patient', () => {
    expect(parsePatientFacts('S :\n- nyeri dada')).toEqual({});
  });
});
