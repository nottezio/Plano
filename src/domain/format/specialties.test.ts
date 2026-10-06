import { describe, expect, it } from 'vitest';

import { consultCovered, dpjpSpecialties, specialtiesInLabel, specialtiesInTitles } from './specialties';

/*
  The DPJP header and TS blocks of a real 6 October note, names replaced.
  Titles kept: they are what the check reads.
*/
const NOTE = [
  '_DPJP Utama: dr. Konsulen A, Sp.JP, Subsp.Eko(K)_',
  '_DPJP Pelimpahan Kardio : dr. Konsulen B, M.Kes,Sp.PD,Sp.JP(K)_',
  '_DPJP Gizi : Prof. Dr. dr. Konsulen C, Sp. GK (K)_',
  '_DPJP HOM : Dr. dr. Konsulen D, Sp. PD, KHOM_',
  '_DPJP KFR : dr. Konsulen E, M.Kes, Sp.KFR.Ped(K)_',
  '_DPJP Derven : Prof. Dr. dr. Konsulen F, Sp.D.V.E, Subsp,O.B.K FINSDV, FAADV_',
].join('\n');

describe('the 6 October note', () => {
  const covered = dpjpSpecialties(NOTE);

  it('Gizi Klinik is the DPJP Gizi', () => {
    expect(consultCovered('Gizi Klinik', covered)).toBe(true);
  });
  it('Rehab is the DPJP KFR', () => {
    expect(consultCovered('Rehab', covered)).toBe(true);
  });
  it('HOM and Derven are listed', () => {
    expect(consultCovered('HOM', covered)).toBe(true);
    expect(consultCovered('Derven', covered)).toBe(true);
  });
  it('Neuro is genuinely missing, and still flagged', () => {
    expect(consultCovered('Neuro', covered)).toBe(false);
  });
});

describe('labels', () => {
  it('a known phrase wins over its words', () => {
    expect([...specialtiesInLabel('Gizi Klinik')]).toEqual(['gizi']);
    expect([...specialtiesInLabel('Bedah Saraf')]).toEqual(['bedah-saraf']);
  });
  it('generic words are not specialties', () => {
    expect(specialtiesInLabel('Utama').size).toBe(0);
    expect([...specialtiesInLabel('Pelimpahan Kardio')]).toEqual(['kardio']);
  });
  it('an unknown name falls back to its stem', () => {
    expect([...specialtiesInLabel('Vaskular')]).toEqual(['~vasku']);
  });
});

describe('titles', () => {
  it.each([
    ['dr. X, Sp.N', 'neuro'],
    ['dr. X, Sp. GK (K)', 'gizi'],
    ['dr. X, Sp.KFR.Ped(K)', 'kfr'],
    ['dr. X, Sp. PD, KHOM', 'hom'],
    ['dr. X, Sp.D.V.E', 'derven'],
    ['dr. X, Sp.PD-KKV', 'kardio'],
  ])('%s names %s', (name, key) => {
    expect(specialtiesInTitles(name).has(key)).toBe(true);
  });

  it('a generic label still counts by its consultant: "DPJP Konsulen 2 : dr. X, Sp.N"', () => {
    expect(consultCovered('Neuro', dpjpSpecialties('_DPJP Konsulen 2 : dr. X, Sp.N_'))).toBe(true);
  });
});

describe('spelling variants still meet', () => {
  it('Pulmo / Pulmonologi / Paru', () => {
    expect(consultCovered('Pulmo', dpjpSpecialties('_DPJP Pulmonologi : dr. X_'))).toBe(true);
    expect(consultCovered('Paru', dpjpSpecialties('_DPJP Pulmo : dr. X_'))).toBe(true);
  });
  it('an unknown service by its stem', () => {
    expect(consultCovered('Vaskular', dpjpSpecialties('_DPJP Vaskuler : dr. X_'))).toBe(true);
    expect(consultCovered('Vaskular', dpjpSpecialties('_DPJP Utama : dr. X_'))).toBe(false);
  });
  it('an RM number in the note is not a DPJP', () => {
    expect(consultCovered('Rehab', dpjpSpecialties('*Tn. X/RM 1000001*\n_DPJP Utama : dr. Y, Sp.JP_'))).toBe(false);
  });
});
