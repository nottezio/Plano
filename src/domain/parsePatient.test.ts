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
      sex: 'P',
    });
  });

  it('handles the spacing variants people actually type', () => {
    expect(parseIdentity('*Tn. Abdullah / 11-04-1967/ 59 tahun/ RM 1667031*')).toEqual({
      name: 'Tn. Abdullah',
      birthDate: '11-04-1967',
      age: 59,
      mrn: '1667031',
      sex: 'L',
    });
    expect(parseIdentity('*Tn. Hamzah Rahuddin / 01-01-1973 / 53 thn / RM 1656066*')).toEqual({
      name: 'Tn. Hamzah Rahuddin',
      birthDate: '01-01-1973',
      age: 53,
      mrn: '1656066',
      sex: 'L',
    });
  });

  it('locates fields by shape, not by position', () => {
    // No birth date: everything else still lands correctly, where splitting on
    // `/` and trusting the order would shift every field by one.
    expect(parseIdentity('*Tn. Budi / 52 tahun / RM 123456*')).toEqual({
      name: 'Tn. Budi',
      age: 52,
      mrn: '123456',
      sex: 'L',
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
      sex: 'P',
      ward: 'PJT Lantai 5',
      room: '517',
      bed: '3',
    });
  });

  it('is empty for a note that says nothing about the patient', () => {
    expect(parsePatientFacts('S :\n- nyeri dada')).toEqual({});
  });
});

describe('sex from the honorific', () => {
  it('reads it from every form that carries it', () => {
    expect(parseIdentity('*Tn. Budi / 52 tahun / RM 1*').sex).toBe('L');
    expect(parseIdentity('*Ny. Siti / 40 tahun / RM 1*').sex).toBe('P');
    expect(parseIdentity('*Nn. Dewi / 19 tahun / RM 1*').sex).toBe('P');
    expect(parseIdentity('*Sdr. Anwar / 22 tahun / RM 1*').sex).toBe('L');
    expect(parseIdentity('*Sdri. Anisa / 21 tahun / RM 1*').sex).toBe('P');
  });

  it('does not guess for An., which is a child of either sex', () => {
    // A wrong value in a field nobody re-checks is worse than an empty one.
    expect(parseIdentity('*An. Rafi / 7 tahun / RM 1*').sex).toBeUndefined();
  });

  it('matches the longer honorific first', () => {
    // `Sdr` prefixes `Sdri`; matching it first would report the wrong sex.
    expect(parseIdentity('*Sdri. Anisa / 21 tahun / RM 1*').sex).toBe('P');
  });

  it('reads the real report lines correctly', () => {
    expect(parseIdentity('*Tn. Ardiansa/ 17-01-1987/ 39 thn / RM 01679091*')).toEqual({
      name: 'Tn. Ardiansa',
      birthDate: '17-01-1987',
      age: 39,
      mrn: '01679091',
      sex: 'L',
    });
    expect(parseIdentity('*Ny. Bubi Dg Pajja/ 01-02-1960/ 66 tahun / RM 1478911*').sex).toBe('P');
  });
});

describe('reading the wrong patient — what the parser must refuse', () => {
  it('ignores an identity line belonging to a different patient further down', () => {
    // A consult reply quotes another patient. Scanning the whole note meant
    // that name could be written into THIS patient's record.
    const note = [
      'Tabe dokter, melaporkan pasien di *PJT Lt 5 Kamar 501* atas nama:',
      '*Tn. Budi Santoso / 01-01-1970 / 56 tahun / RM 1111111*',
      '',
      '*S:*',
      '- nyeri dada tidak ada',
      '',
      '*TS Neuro*',
      'Balasan konsul untuk *Ny. Siti Aminah / 02-02-1960 / 66 tahun / RM 9999999*',
    ].join('\n');

    const result = parseIdentity(note);
    expect(result.name).toBe('Tn. Budi Santoso');
    expect(result.mrn).toBe('1111111');
  });

  it('refuses a template placeholder line', () => {
    // It matches the identity shape exactly, and filling from it would write
    // "(Nama)" as somebody's name.
    const blank = 'melaporkan pasien atas nama:\n*(Nama) / (tgl lahir) / (umur) / RM (no)*';
    expect(parseIdentity(blank)).toEqual({});
  });

  it('rejects a record number too short to be one', () => {
    // A wrong MRN is the worst output this parser has, because it is what
    // identifies the patient to another system.
    expect(parseIdentity('*Tn. Budi / 52 tahun / RM 5*').mrn).toBeUndefined();
  });

  it('rejects a record number absurdly long', () => {
    expect(parseIdentity('*Tn. Budi / 52 tahun / RM 1234567890123456*').mrn).toBeUndefined();
  });

  it('still reads the real lines it is meant to', () => {
    expect(parseIdentity('*Tn. Ardiansa/ 17-01-1987/ 39 thn / RM 01679091*').mrn).toBe(
      '01679091',
    );
  });

  it('takes the location from the opening, not from a quoted report', () => {
    const note = [
      'melaporkan pasien di *PJT Lt 5 Kamar 501 Bed 2* atas nama:',
      '*Tn. Budi / 52 tahun / RM 123456*',
      '',
      '*S:*',
      '- dirujuk dari *CVCU bed 9* atas nama pasien lain',
    ].join('\n');
    expect(parseLocation(note)).toEqual({ ward: 'PJT Lt 5', room: '501', bed: '2' });
  });
});

/**
 * The regression this file exists to prevent recurring.
 *
 * `openingBlock` used a local regex whose `Mohon i[zj]in` alternative matched
 * the opening's own reporting sentence — the line directly ABOVE the identity
 * line — as if it were the assessment heading. The boundary landed above the
 * identity, so both parsers returned nothing.
 *
 * It looked intermittent because it depended on one keystroke: whether the
 * greeting shared a line with the reporting sentence, or the resident pressed
 * Enter after it. Both shapes are in real use, so both are asserted here.
 */
describe('the reporting sentence is part of the opening, not a clinical heading', () => {
  const IDENTITY = '*Tn. Basra / 12-03-1970 / 56 tahun / RM 1068190*';
  const REPORT = 'Mohon izin melaporkan pasien di *PJT Lantai 5 Kamar 517 Bed 3* atas nama:';

  const SPLIT = `Assalamualaikum dokter, selamat pagi dokter.\n${REPORT}\n\n${IDENTITY}\n\n_DPJP Kardio: dr. Zaenab Djafar, Sp.JP(K)_\n\n*S:*\nSesak berkurang`;
  const JOINED = `Assalamualaikum dokter, selamat pagi dokter. ${REPORT}\n\n${IDENTITY}\n\n*S:*\nSesak berkurang`;

  it('reads the identity whether or not the greeting shares the line', () => {
    for (const body of [SPLIT, JOINED]) {
      const facts = parsePatientFacts(body);
      expect(facts.mrn).toBe('1068190');
      expect(facts.name).toBe('Tn. Basra');
      expect(facts.birthDate).toBe('12-03-1970');
    }
  });

  it('reads the ward, room and bed in both shapes', () => {
    for (const body of [SPLIT, JOINED]) {
      const facts = parsePatientFacts(body);
      expect(facts.ward).toBe('PJT Lantai 5');
      expect(facts.room).toBe('517');
      expect(facts.bed).toBe('3');
    }
  });

  it('still stops at the real assessment heading', () => {
    // The boundary must not simply have been widened: a second patient named
    // below the clinical content is the failure the boundary exists to stop.
    const body = `${REPORT}\n\n${IDENTITY}\n\n*Mohon izin kami assess dengan:*\n- CHF\n\n*TS BTKV*\nPasien lain *Tn. Salah Orang / 01-01-1950 / 76 tahun / RM 9999999*`;
    expect(parseIdentity(body).mrn).toBe('1068190');
  });

  it('does not treat the greeting itself as the assessment section', () => {
    // `Assalamualaikum` contains the `as+e?s+` stem the prose classifier uses.
    // If it were ever read as a heading the opening would collapse to nothing.
    const body = `Assalamualaikum dokter.\n\n${IDENTITY}\n\n*S:*\n- Sesak`;
    expect(parseIdentity(body).mrn).toBe('1068190');
  });
});
