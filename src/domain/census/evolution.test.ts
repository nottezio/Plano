import { describe, expect, it } from 'vitest';

import {
  diffSnapshots,
  evolution,
  evolutionGrid,
  patientLocation,
  patientName,
  readSnapshot,
  snapshotId,
  type CensusSnapshot,
  type SnapPatient,
} from './evolution';

const P = (key: string, name: string, place: SnapPatient['place'], location: string, diagnoses: string[] = []): SnapPatient => ({
  key,
  name,
  place,
  location,
  identity: `${location}/ ${name}/ RM ${key.slice(3)}`,
  diagnoses,
  kjs: '',
});

const S = (date: string, patients: SnapPatient[], covers: SnapPatient['place'][] = ['RSWS', 'CVCU', 'LT4', 'LT5']): CensusSnapshot => ({
  code: 'ARB',
  date,
  patients,
  covers,
  savedAt: 0,
  source: 'aturan',
});

const A = P('rm:1', 'Tn. Satu', 'CVCU', 'CVCU Bed 5', ['- CHF']);
const B = P('rm:2', 'Ny. Dua', 'LT5', '514 bed 1');
const C = P('rm:3', 'Tn. Tiga', 'RSWS', 'Lontara 1 Kamar 8');

describe('patientName / patientLocation', () => {
  it('reads the name and the place from the line shapes the lists use', () => {
    expect(patientName('CVCU Bed 5/ Tn. Contoh / 02-06-1989 / RM 1700002 / dr. ZD')).toBe('Tn. Contoh');
    expect(patientLocation('CVCU Bed 5/ Tn. Contoh / 02-06-1989 / RM 1700002 / dr. ZD', 'ZD')).toBe('CVCU Bed 5');
    expect(patientLocation('420 Bed 4/ZD/Tn. Contoh/RM 1700002', 'ZD')).toBe('420 Bed 4');
    expect(patientLocation('ARB Lontara 1 Kamar 4 Bed 2 / Tn. Contoh / RM 1700003', 'ARB')).toBe('Lontara 1 Kamar 4 Bed 2');
    expect(patientLocation('KJS Uro / ARB / 603 Lepa B Bed 3 / Tn. Contoh/ RM 1700004', 'ARB')).toBe('603 Lepa B Bed 3');
    expect(patientLocation('ZD (KJS) / Lontara 1 Kamar 8 / Tn. Contoh', 'ZD')).toBe('Lontara 1 Kamar 8');
    expect(patientLocation('AHA / PCC / Kamar 311 / H. Contoh / RM 1700005', 'AHA')).toBe('PCC / Kamar 311');
    expect(patientLocation('CVCU Bed 12/ (BTKV) Contoh / RM 1700019/ ARB', 'ARB')).toBe('CVCU Bed 12');
  });
});

describe('diffSnapshots', () => {
  it('finds who came, who left, who moved and whose diagnoses changed', () => {
    const before = S('2026-10-09', [A, B]);
    const moved = { ...A, place: 'LT4' as const, location: '420 Bed 4', diagnoses: ['- CHF', '- Sirosis Hepatis'] };
    const after = S('2026-10-10', [moved, C]);
    const changes = diffSnapshots(before, after);
    expect(changes.map((change) => [change.kind, change.patient.key])).toEqual([
      ['baru', 'rm:3'],
      ['keluar', 'rm:2'],
      ['pindah', 'rm:1'],
      ['dx', 'rm:1'],
    ]);
    const pindah = changes.find((change) => change.kind === 'pindah');
    expect(pindah && 'from' in pindah ? [pindah.from, pindah.to] : []).toEqual(['CVCU/HCU/ICU PJT CVCU Bed 5', 'PJT Lt. 4 420 Bed 4']);
    const dx = changes.find((change) => change.kind === 'dx');
    expect(dx && 'added' in dx ? dx.added : []).toEqual(['- Sirosis Hepatis']);
  });

  it('says "not checked", not "left", when the place was not in today\'s lists', () => {
    const changes = diffSnapshots(S('2026-10-09', [A, B]), S('2026-10-10', [A], ['CVCU']));
    expect(changes.map((change) => change.kind)).toEqual(['tidak-dicek']);
  });

  it('ignores bullet and spacing differences in diagnoses', () => {
    const changes = diffSnapshots(S('2026-10-09', [A]), S('2026-10-10', [{ ...A, diagnoses: ['•  chf'] }]));
    expect(changes).toEqual([]);
  });
});

describe('evolution / evolutionGrid', () => {
  const days = [S('2026-10-08', [A, B]), S('2026-10-10', [A, C]), S('2026-10-09', [A, B])];

  it('compares each day with the snapshot before it, newest first, skipping days nobody sent', () => {
    const list = evolution(days);
    expect(list.map((day) => [day.date, day.count, day.first, day.changes.length])).toEqual([
      ['2026-10-10', 2, false, 2],
      ['2026-10-09', 2, false, 0],
      ['2026-10-08', 2, true, 0],
    ]);
  });

  it('lays patients against dates, current ones first', () => {
    const { dates, rows } = evolutionGrid(days);
    expect(dates).toEqual(['2026-10-08', '2026-10-09', '2026-10-10']);
    expect(rows.map((row) => [row.key, row.current, row.days])).toEqual([
      ['rm:3', true, 1], // RSWS sorts before CVCU
      ['rm:1', true, 3],
      ['rm:2', false, 2],
    ]);
    expect(rows[2]?.cells.map((cell) => (cell && cell !== 'unchecked' ? '●' : cell))).toEqual(['●', '●', null]);
  });
});

describe('storage helpers', () => {
  it('makes a safe id and reads stored shapes defensively', () => {
    expect(snapshotId('arb', '2026-10-10')).toBe('ARB~2026-10-10');
    expect(readSnapshot({ code: 'ARB', date: 'x' })).toBeNull();
    const read = readSnapshot({ code: 'ARB', date: '2026-10-10', patients: [{ key: 'rm:1', place: 'Mars' }, 'junk'], covers: ['CVCU', 'Mars'] });
    expect(read?.patients[0]?.place).toBe('PJT');
    expect(read?.covers).toEqual(['CVCU']);
  });
});

describe('the path a patient took', () => {
  it('reads CVCU → Lt. 4 for a transfer', () => {
    const moved = { ...A, place: 'LT4' as const, location: '420 Bed 4' };
    const { rows } = evolutionGrid([S('2026-10-08', [A]), S('2026-10-09', [A]), S('2026-10-10', [moved])]);
    expect(rows[0]?.path).toBe('CVCU → Lt. 4');
    expect(rows[0]?.days).toBe(3);
  });
});
