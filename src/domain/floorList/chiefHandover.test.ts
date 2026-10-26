import { describe, expect, it } from 'vitest';

import { chiefSuggestions, isJamDinas, nextJamDinas } from './chiefHandover';
import { newRosterPatient, type FloorDoc, type RosterPatient } from './floor';
import type { FloorPatient } from './report';

const FLOOR: FloorDoc = {
  id: 'f1',
  name: 'PJT Lantai 4',
  ward: 'PJT Lantai 4',
  ownerUid: 'owner',
  memberIds: ['owner'],
  roles: { owner: 'edit' },
  names: {},
  invites: {},
  inviteEmails: [],
  nicknames: {},
  chiefs: '',
  chiefBangsal: 'Kirana',
  juniors: '',
  marks: [],
  analysisTitles: {},
};

function report(over: Partial<FloorPatient> = {}): FloorPatient {
  return {
    key: 'rm:1',
    rm: '1',
    name: 'Tn. Contoh',
    identity: 'Tn. Contoh/RM 1',
    room: '417',
    bed: '1',
    floor: '4',
    dpjpId: 'ks',
    kjsDpjpIds: [],
    btkv: false,
    body: 'Diagnosis:\n- X',
    full: 'laporan',
    chief: '',
    junior: '',
    senderNick: 'Bima',
    sender: 'dr. Muh Bima Contoh',
    sentAt: '2026-10-26T06:00',
    index: 0,
    discharge: null,
    ...over,
  };
}

const rostered = (state: Partial<RosterPatient> = {}): RosterPatient => ({
  ...newRosterPatient(report(), '2026-10-24T00:00:00.000Z', 'Saya'),
  ...state,
});

// Local clock. 26/10/2026 is a Monday.
const at = (day: number, hour: number, minute = 0): Date => new Date(2026, 9, day, hour, minute);
const MON_0700 = at(26, 7);
const DATE = '2026-10-26';
const run = (roster: RosterPatient[], now = MON_0700, floor = FLOOR, opts?: { ignoreClock?: boolean }) =>
  chiefSuggestions(roster, floor, DATE, now, opts).map(({ from, to }) => ({ from, to }));

describe('isJamDinas', () => {
  it('is Mon–Fri 07.00 up to (not including) 16.00', () => {
    expect(isJamDinas(at(26, 6, 59))).toBe(false);
    expect(isJamDinas(at(26, 7))).toBe(true);
    expect(isJamDinas(at(26, 15, 59))).toBe(true);
    expect(isJamDinas(at(26, 16))).toBe(false);
    expect(isJamDinas(at(30, 15, 59))).toBe(true); // Friday
    expect(isJamDinas(at(31, 10))).toBe(false); // Saturday
    expect(isJamDinas(new Date(2026, 10, 1, 10))).toBe(false); // Sunday
  });
});

describe('nextJamDinas', () => {
  it('Friday night → Monday 07.00', () => {
    expect(nextJamDinas(at(30, 20))).toEqual(new Date(2026, 10, 2, 7));
  });
  it('a weekday before 07.00 → the same day', () => {
    expect(nextJamDinas(at(27, 5))).toEqual(at(27, 7));
  });
  it('a weekday after 16.00 → the next day', () => {
    expect(nextJamDinas(at(27, 16, 30))).toEqual(at(28, 7));
  });
});

describe('chiefSuggestions', () => {
  it('suggests the Chief Bangsal for a patient of the previous chief, in jam dinas only', () => {
    const roster = [rostered({ chief: 'Bima' })];
    expect(run(roster)).toEqual([{ from: 'Bima', to: 'Kirana' }]);
    expect(run(roster, at(31, 10))).toEqual([]);
  });

  it('a name variant of the Chief Bangsal is the same person', () => {
    expect(run([rostered({ chief: 'dr. Kirana' })])).toEqual([]);
    expect(run([rostered({ chief: 'kirana' })])).toEqual([]);
    expect(run([rostered({ chief: 'Kirana A' })])).toEqual([]);
  });

  it('two different chiefs with similar names are not merged', () => {
    const ari = { ...FLOOR, chiefBangsal: 'Ari' };
    expect(run([rostered({ chief: 'dr. Arif' })], MON_0700, ari)).toEqual([{ from: 'dr. Arif', to: 'Ari' }]);
    expect(run([rostered({ chief: 'Rizka' })], MON_0700, { ...FLOOR, chiefBangsal: 'Rizky' })).toEqual([{ from: 'Rizka', to: 'Rizky' }]);
  });

  it('a name starting with "Dr" keeps its letters', () => {
    expect(run([rostered({ chief: 'Drajat' })], MON_0700, { ...FLOOR, chiefBangsal: 'Ajat' })).toEqual([{ from: 'Drajat', to: 'Ajat' }]);
  });

  it('Ganti chief is the target, and nothing is suggested once it is the chief', () => {
    expect(run([rostered({ chief: 'Bima', gantiChief: 'Yoga' })])).toEqual([{ from: 'Bima', to: 'Yoga' }]);
    expect(run([rostered({ chief: 'Yoga', gantiChief: 'Yoga' })])).toEqual([]);
  });

  it('skips division patients, patients who left, and floors without a Chief Bangsal', () => {
    expect(run([rostered({ chief: 'Bima', division: 'Aritmia' })])).toEqual([]);
    expect(run([rostered({ chief: 'Bima', status: 'pulang' })])).toEqual([]);
    expect(run([rostered({ chief: 'Bima' })], MON_0700, { ...FLOOR, chiefBangsal: '' })).toEqual([]);
  });

  it('Abaikan lasts until the next jam dinas', () => {
    const roster = [rostered({ chief: 'Bima', chiefDismissed: at(26, 10).toISOString() })];
    expect(run(roster, at(26, 11))).toEqual([]);
    expect(run(roster, at(27, 7))).toEqual([{ from: 'Bima', to: 'Kirana' }]);
  });

  it('a patient without a chief is suggested; Abaikan on it is for good, until a chief is written', () => {
    expect(run([rostered()])).toEqual([{ from: '', to: 'Kirana' }]);
    const dismissed = rostered({ chiefDismissed: at(19, 10).toISOString() });
    expect(run([dismissed])).toEqual([]);
    expect(run([{ ...dismissed, chief: 'Bima' }])).toEqual([{ from: 'Bima', to: 'Kirana' }]);
  });

  it('ignoreClock: the off-hours reminder still finds them', () => {
    expect(run([rostered({ chief: 'Bima' })], at(31, 10), FLOOR, { ignoreClock: true })).toEqual([{ from: 'Bima', to: 'Kirana' }]);
  });
});
