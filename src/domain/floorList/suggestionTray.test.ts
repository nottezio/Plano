import { describe, expect, it } from 'vitest';

import { newRosterPatient, type FloorDoc, type RosterPatient } from './floor';
import type { FloorPatient } from './report';
import { buildTray, doneText, groupTray } from './suggestionTray';

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
  guestJuniors: '',
  newBadge: null,
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
    chief: 'Ari',
    junior: '',
    senderNick: 'Bima',
    sender: 'dr. Muh Bima Contoh',
    sentAt: '2026-10-26T06:00',
    index: 0,
    discharge: null,
    ...over,
  };
}

const rostered = (over: Partial<FloorPatient> = {}, state: Partial<RosterPatient> = {}): RosterPatient => ({
  ...newRosterPatient(report(over), '2026-10-24T00:00:00.000Z', 'Saya'),
  ...state,
});

const DATE = '2026-10-26';
const MON_0700 = new Date(2026, 9, 26, 7);
const MON_2000 = new Date(2026, 9, 26, 20);
const PLAN_H1 = 'Diagnosis:\n- X\nTerapi:\n- Y\nPlan:\n- H-1 hari ini';
const PLAN_USUL = 'Diagnosis:\n- X\nTerapi:\n- Y\nPlan:\n- Usul H-1';

describe('buildTray', () => {
  it('is empty when nothing is proposed', () => {
    const tray = buildTray([rostered({ chief: 'Kirana' })], FLOOR, DATE, MON_0700);
    expect(tray.rows).toEqual([]);
  });

  it('lists a Plan that says H-1 as one row with Tandai and Abaikan', () => {
    const { rows } = buildTray([rostered({ body: PLAN_H1, chief: 'Kirana' })], FLOOR, DATE, MON_2000);
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row).toMatchObject({ kind: 'discharge', room: '417', bed: '1', lead: 'Plan menyebut', strong: 'H-1' });
    expect(row?.actions.map((a) => a.label)).toEqual(['Tandai']);
    expect(row?.actions[0]?.done).toBe('H-1');
    expect(row?.dismiss.write.fields).toEqual({ dismissed: '2026-10-26T06:00' });
    expect(row?.dismiss.write.log).toBeUndefined();
  });

  it('offers both answers for an usul and names it as not yet certain', () => {
    const { rows } = buildTray([rostered({ body: PLAN_USUL, chief: 'Kirana' })], FLOOR, DATE, MON_2000);
    expect(rows[0]?.strong).toBe('usul H-1 (belum pasti)');
    expect(rows[0]?.actions.map((a) => a.label)).toEqual(['Tandai usul', 'Sudah pasti H-1']);
  });

  it('shows the chief handover at any weekday hour (also hours before 07.00), as a Terima that writes the chief and a log line', () => {
    const roster = [rostered()];
    const { rows } = buildTray(roster, FLOOR, DATE, MON_0700);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'chief', lead: 'Chief Ari →', strong: 'dr. Kirana' });
    expect(rows[0]?.actions[0]?.write).toEqual({ fields: { chief: 'Kirana' }, log: { what: 'Chief → dr. Kirana (saran jam dinas)' } });
    expect(rows[0]?.actions[0]?.done).toBe('Chief → dr. Kirana');

    const evening = buildTray(roster, FLOOR, DATE, MON_2000);
    expect(evening.rows).toHaveLength(1);
    expect(buildTray(roster, FLOOR, DATE, new Date(2026, 9, 26, 3)).rows).toHaveLength(1);
  });

  it('clears a planned Ganti chief when the handover is accepted', () => {
    const { rows } = buildTray([rostered({}, { gantiChief: 'Rizky' })], FLOOR, DATE, MON_0700);
    expect(rows[0]?.actions[0]?.write.fields).toEqual({ chief: 'Rizky', gantiChief: '' });
  });

  it('gives every row an id that changes with a new SOAP, so a fresh proposal is not hidden', () => {
    const a = buildTray([rostered({ body: PLAN_H1, chief: 'Kirana' })], FLOOR, DATE, MON_2000).rows[0]?.id;
    const b = buildTray([rostered({ body: PLAN_H1, chief: 'Kirana', sentAt: '2026-10-26T09:00' })], FLOOR, DATE, MON_2000).rows[0]?.id;
    expect(a).toBeDefined();
    expect(a).not.toBe(b);
  });

  it('puts discharge proposals before chief handovers', () => {
    const roster = [
      rostered({ key: 'rm:1', rm: '1' }),
      rostered({ key: 'rm:2', rm: '2', body: PLAN_H1, chief: 'Kirana' }),
    ];
    expect(buildTray(roster, FLOOR, DATE, MON_0700).rows.map((r) => r.kind)).toEqual(['discharge', 'chief']);
  });
});

describe('groupTray (11 Nov 2026)', () => {
  it('one line per proposal: H-1 together, usul apart, chief by the incoming chief', () => {
    const roster = [
      rostered({ key: 'rm:1', rm: '1', body: PLAN_H1, chief: 'Kirana' }),
      rostered({ key: 'rm:2', rm: '2', body: PLAN_USUL, chief: 'Kirana' }),
      rostered({ key: 'rm:3', rm: '3', body: PLAN_H1, chief: 'Kirana' }),
      rostered({ key: 'rm:4', rm: '4', chief: 'Ari' }),
      rostered({ key: 'rm:5', rm: '5', chief: 'Budi' }),
    ];
    const groups = groupTray(buildTray(roster, FLOOR, DATE, MON_0700).rows);
    expect(groups.map((g) => [g.title, g.rows.map((r) => r.key)])).toEqual([
      ['Plan menyebut H-1', ['rm:1', 'rm:3']],
      ['Plan menyebut usul H-1 (belum pasti)', ['rm:2']],
      ['Ganti chief → dr. Kirana', ['rm:4', 'rm:5']],
    ]);
  });
});

describe('doneText', () => {
  it('drops the trailing explanation of a log line', () => {
    expect(doneText('H-1 (dari saran Plan)')).toBe('H-1');
    expect(doneText('Usul H-1')).toBe('Usul H-1');
  });
});
