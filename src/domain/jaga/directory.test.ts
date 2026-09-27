import { describe, expect, it } from 'vitest';

import { buildDirectory, refreshSwap, searchResidents } from './directory';
import type { JagaRoster, JarkomDirectory } from './types';

const ROSTER = {
  title: '',
  shifts: [],
  initials: {
    JL: 'dr. Jordy Liong',
    RH: 'dr. M. Rheza Rivaldi Salam',
    AV: 'dr. Mevlana Muhammad Avicenna Pasiak',
  },
  importedAt: '',
} as JagaRoster;

const JARKOM: JarkomDirectory = {
  entries: [
    { name: 'dr. Jordy Liong', panggilan: 'Jordy', muslim: false },
    { name: 'dr. M. Rheza Rivaldi Salam', panggilan: 'Rheza', muslim: true },
  ],
  importedAt: '',
};

const DIR = buildDirectory(ROSTER, JARKOM);

describe('buildDirectory', () => {
  it('joins the rota to the nicknames and agama', () => {
    expect(DIR.find((r) => r.initials === 'RH')).toMatchObject({
      panggilan: 'Rheza',
      muslim: true,
    });
  });

  it('keeps the ROSTER spelling of the name, never Jarkom’s', () => {
    expect(DIR.find((r) => r.initials === 'JL')?.name).toBe('dr. Jordy Liong');
  });

  it('includes someone Jarkom has no row for', () => {
    // The rota is the spine. A resident who joined since the Jarkom sheet was
    // published is still on tonight and must be swappable.
    expect(DIR.find((r) => r.initials === 'AV')).toMatchObject({
      panggilan: null,
      muslim: null,
    });
  });
});

describe('searchResidents', () => {
  const names = (q: string): string[] =>
    searchResidents(DIR, q).map((r) => r.initials);

  it('finds a resident by the nickname they are actually called', () => {
    // The point of the whole feature: "Rheza" must reach
    // `dr. M. Rheza Rivaldi Salam`, which searching full names alone does too
    // — but "Jordy" reaching `dr. Jordy Liong` by nickname is what ranks it
    // first when both could match.
    expect(names('rheza')).toContain('RH');
    expect(names('jordy')[0]).toBe('JL');
  });

  it('finds by initials, exactly', () => {
    expect(names('av')[0]).toBe('AV');
  });

  it('finds by any part of the full name', () => {
    expect(names('pasiak')).toContain('AV');
  });

  it('returns nothing for an empty query rather than the whole rota', () => {
    expect(searchResidents(DIR, '   ')).toEqual([]);
  });

  it('caps the list', () => {
    expect(searchResidents(DIR, 'dr', 2)).toHaveLength(2);
  });
});

describe('refreshSwap', () => {
  const residents = [
    { initials: 'BR', name: 'dr. Bayu Refki Hakim', panggilan: 'Hakim', muslim: true, linked: true, ambiguous: [] },
    { initials: 'XX', name: 'dr. X', panggilan: null, muslim: null, linked: false, ambiguous: [] },
  ];

  it('a picked swap follows what the directory now knows', () => {
    expect(refreshSwap({ name: 'Bayu Rendi Hakim', initials: 'BR', muslim: false }, residents)).toEqual({
      name: 'Hakim',
      initials: 'BR',
      muslim: true,
    });
  });

  it('a typed swap, or one the directory cannot name, is left alone', () => {
    expect(refreshSwap({ name: 'Suci' }, residents)).toEqual({ name: 'Suci' });
    expect(refreshSwap({ name: 'X', initials: 'XX' }, residents)).toEqual({ name: 'X', initials: 'XX' });
  });
});

describe('buildDirectory with an undecidable name', () => {
  it('leaves nickname empty and lists the rows until linked', () => {
    const roster = { title: '', shifts: [], importedAt: '', initials: { BR: 'dr. Bayu Rendi Hakim' } };
    const jarkom = {
      importedAt: '',
      entries: [
        { name: 'dr. Bayu Rendi Pratama', panggilan: 'Rendi', muslim: true },
        { name: 'dr. Bayu Refki Hakim', panggilan: 'Hakim', muslim: true },
      ],
    };
    const [open] = buildDirectory(roster, jarkom);
    expect(open).toMatchObject({ panggilan: null, linked: false });
    expect(open!.ambiguous).toHaveLength(2);
    const [linked] = buildDirectory(roster, jarkom, { BR: 'dr. Bayu Refki Hakim' });
    expect(linked).toMatchObject({ panggilan: 'Hakim', name: 'dr. Bayu Refki Hakim', linked: true });
  });
});
