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
  holidays: [],
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
  it('is the latest Monday-to-Thursday 16.00 or Sunday 07.00 not after now', () => {
    expect(handoverCycleStart(at(26, 10))).toEqual(at(25, 7)); // Monday jam dinas → Sunday 07.00
    expect(handoverCycleStart(at(26, 5))).toEqual(at(25, 7)); // Monday early morning
    expect(handoverCycleStart(at(25, 7))).toEqual(at(25, 7));
    expect(handoverCycleStart(at(26, 16))).toEqual(at(26, 16));
    expect(handoverCycleStart(at(26, 20))).toEqual(at(26, 16));
    expect(handoverCycleStart(at(30, 10))).toEqual(at(29, 16)); // Friday jam dinas → Thursday 16.00
    expect(handoverCycleStart(at(31, 10))).toEqual(at(29, 16)); // Saturday → Thursday 16.00
    expect(handoverCycleStart(at(25, 6))).toEqual(at(22, 16)); // Sunday before it opens
  });

  it('treats a tanggal merah as a day off', () => {
    const wednesday = ['2026-10-28'];
    expect(handoverCycleStart(at(27, 20), wednesday)).toEqual(at(26, 16)); // no handover on the holiday itself
    expect(handoverCycleStart(at(28, 10), wednesday)).toEqual(at(28, 7));
    expect(handoverCycleStart(at(29, 10), wednesday)).toEqual(at(28, 7));
  });
});

describe('chiefSuggestions', () => {
  it('suggests the Chief Bangsal for a patient of the previous chief, at any weekday hour (early, for the printed list)', () => {
    const roster = [rostered({ chief: 'Bima' })];
    expect(run(roster)).toEqual([{ from: 'Bima', to: 'Kirana' }]);
    expect(run(roster, at(26, 3))).toEqual([{ from: 'Bima', to: 'Kirana' }]); // 4 h before the change
    expect(run(roster, at(26, 20))).toEqual([{ from: 'Bima', to: 'Kirana' }]); // Monday evening, for Tuesday
  });

  it('is hidden over the weekend until 24 hours before Monday 07.00', () => {
    const roster = [rostered({ chief: 'Bima' })];
    const shown = [{ from: 'Bima', to: 'Kirana' }];
    expect(run(roster, at(23, 15, 59))).toEqual(shown); // Friday jam dinas
    expect(run(roster, at(23, 16))).toEqual([]); // Friday, end of jam dinas
    expect(run(roster, at(24, 20))).toEqual([]); // Saturday night
    expect(run(roster, at(25, 6, 59))).toEqual([]);
    expect(run(roster, at(25, 7))).toEqual(shown); // Sunday 07.00: exactly 24 hours before
    expect(run(roster, at(25, 22))).toEqual(shown); // Sunday night
  });

  describe('tanggal merah', () => {
    const roster = [rostered({ chief: 'Bima' })];
    const shown = [{ from: 'Bima', to: 'Kirana' }];
    const off = (...holidays: string[]): FloorDoc => ({ ...FLOOR, holidays });

    it('a weekday off: nothing from 16.00 the day before until 07.00 on the day', () => {
      const floor = off('2026-10-28'); // Wednesday
      expect(run(roster, at(27, 15, 59), floor)).toEqual(shown); // Tuesday's own handover
      expect(run(roster, at(27, 16), floor)).toEqual([]);
      expect(run(roster, at(28, 6, 59), floor)).toEqual([]);
      expect(run(roster, at(28, 7), floor)).toEqual(shown); // 24 hours before Thursday 07.00
      expect(run(roster, at(29, 3), floor)).toEqual(shown);
    });

    it('a Monday off: Sunday stays quiet and Monday 07.00 opens for Tuesday', () => {
      const floor = off('2026-10-26');
      expect(run(roster, at(25, 7), floor)).toEqual([]);
      expect(run(roster, at(26, 6, 59), floor)).toEqual([]);
      expect(run(roster, at(26, 7), floor)).toEqual(shown);
    });

    it('Thursday and Friday off: the gap runs through the weekend to Sunday 07.00', () => {
      const floor = off('2026-10-29', '2026-10-30');
      expect(run(roster, at(28, 15, 59), floor)).toEqual(shown);
      expect(run(roster, at(28, 16), floor)).toEqual([]);
      expect(run(roster, at(30, 10), floor)).toEqual([]);
      expect(run(roster, at(32, 6, 59), floor)).toEqual([]); // Sunday 1 November
      expect(run(roster, at(32, 7), floor)).toEqual(shown);
    });

    it('marked on a weekend it changes nothing', () => {
      const floor = off('2026-10-31');
      expect(run(roster, at(30, 15), floor)).toEqual(shown);
      expect(run(roster, at(32, 7), floor)).toEqual(shown);
    });

    it('an Abaikan before the holiday was marked does not hide the next handover', () => {
      const dismissed = [rostered({ chief: 'Bima', chiefDismissed: at(27, 10).toISOString() })];
      const floor = off('2026-10-28');
      expect(run(dismissed, at(27, 15), floor)).toEqual([]);
      expect(run(dismissed, at(28, 7), floor)).toEqual(shown);
    });
  });

  it('an Abaikan from before the handover opened does not hide it', () => {
    const friday = [rostered({ chief: 'Bima', chiefDismissed: at(23, 10).toISOString() })];
    expect(run(friday, at(23, 15))).toEqual([]);
    expect(run(friday, at(25, 7))).toEqual([{ from: 'Bima', to: 'Kirana' }]);
    const saturday = [rostered({ chief: 'Bima', chiefDismissed: at(24, 20).toISOString() })];
    expect(run(saturday, at(25, 7))).toEqual([{ from: 'Bima', to: 'Kirana' }]);
    const sunday = [rostered({ chief: 'Bima', chiefDismissed: at(25, 8).toISOString() })];
    expect(run(sunday, at(26, 10))).toEqual([]); // the answer to Monday's handover holds through Monday
    expect(run(sunday, at(26, 16))).toEqual([{ from: 'Bima', to: 'Kirana' }]);
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
