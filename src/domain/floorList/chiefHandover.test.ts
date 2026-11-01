import { describe, expect, it } from 'vitest';

import { chiefSuggestions, handoverCycleStart } from './chiefHandover';
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
const run = (roster: RosterPatient[], now = MON_0700, floor = FLOOR) =>
  chiefSuggestions(roster, floor, DATE, now).map(({ from, to }) => ({ from, to }));

describe('handoverCycleStart', () => {
  it('is the latest weekday 16.00 not after now', () => {
    expect(handoverCycleStart(at(26, 10))).toEqual(at(23, 16)); // Monday jam dinas → Friday 16.00
    expect(handoverCycleStart(at(26, 5))).toEqual(at(23, 16)); // Monday early morning
    expect(handoverCycleStart(at(26, 16))).toEqual(at(26, 16));
    expect(handoverCycleStart(at(26, 20))).toEqual(at(26, 16));
    expect(handoverCycleStart(at(31, 10))).toEqual(at(30, 16)); // Saturday → Friday 16.00
  });
});

describe('chiefSuggestions', () => {
  it('suggests the Chief Bangsal for a patient of the previous chief, at any hour (early, for the printed list)', () => {
    const roster = [rostered({ chief: 'Bima' })];
    expect(run(roster)).toEqual([{ from: 'Bima', to: 'Kirana' }]);
    expect(run(roster, at(26, 3))).toEqual([{ from: 'Bima', to: 'Kirana' }]); // 4 h before the change
    expect(run(roster, at(23, 17))).toEqual([{ from: 'Bima', to: 'Kirana' }]); // Friday evening
    expect(run(roster, at(31, 10))).toEqual([{ from: 'Bima', to: 'Kirana' }]); // Saturday
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

  it('Abaikan lasts until the end of that jam dinas (16.00), then the next handover is asked again', () => {
    const roster = [rostered({ chief: 'Bima', chiefDismissed: at(26, 10).toISOString() })];
    expect(run(roster, at(26, 11))).toEqual([]);
    expect(run(roster, at(26, 15, 59))).toEqual([]);
    expect(run(roster, at(26, 16))).toEqual([{ from: 'Bima', to: 'Kirana' }]);
    const early = [rostered({ chief: 'Bima', chiefDismissed: at(27, 4).toISOString() })];
    expect(run(early, at(27, 6))).toEqual([]);
    expect(run(early, at(27, 9))).toEqual([]);
  });

  it('a patient without a chief is suggested; Abaikan on it is for good, until a chief is written', () => {
    expect(run([rostered()])).toEqual([{ from: '', to: 'Kirana' }]);
    const dismissed = rostered({ chiefDismissed: at(19, 10).toISOString() });
    expect(run([dismissed])).toEqual([]);
    expect(run([{ ...dismissed, chief: 'Bima' }])).toEqual([{ from: 'Bima', to: 'Kirana' }]);
  });
});
