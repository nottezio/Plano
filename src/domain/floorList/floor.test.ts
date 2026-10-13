import { describe, expect, it } from 'vitest';

import {
  canEdit,
  chiefsOf,
  colourOn,
  divisionOf,
  effective,
  isOwner,
  leftNote,
  leftSince,
  localStamp,
  newRosterPatient,
  pasteDiff,
  rosterName,
  rosterView,
  suggestionFor,
  updatedReport,
  type FloorDoc,
  type RosterPatient,
} from './floor';
import type { FloorPatient } from './report';

const FLOOR: FloorDoc = {
  id: 'f1',
  name: 'PJT Lantai 4',
  ward: 'PJT Lantai 4',
  ownerUid: 'owner',
  memberIds: ['owner', 'ed', 'vi'],
  roles: { owner: 'edit', ed: 'edit', vi: 'view' },
  names: {},
  invites: {},
  inviteEmails: [],
  nicknames: { 'dr. Muh Bima Contoh': 'Dani' },
  chiefs: '',
  juniors: '',
  marks: [],
};

function patient(over: Partial<FloorPatient>): FloorPatient {
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
    sentAt: '2026-10-12T07:00',
    index: 0,
    discharge: null,
    ...over,
  };
}

function rostered(over: Partial<FloorPatient> = {}, state: Partial<RosterPatient> = {}): RosterPatient {
  return { ...newRosterPatient(patient(over), '2026-10-12T00:00:00.000Z', 'Saya'), ...state };
}

describe('roles', () => {
  it('owner and edit members edit; view members do not; outsiders do not', () => {
    expect([canEdit(FLOOR, 'owner'), canEdit(FLOOR, 'ed'), canEdit(FLOOR, 'vi'), canEdit(FLOOR, 'x'), canEdit(FLOOR, null)]).toEqual([
      true, true, false, false, false,
    ]);
    expect(isOwner(FLOOR, 'ed')).toBe(false);
  });
});

describe('chiefsOf / effective', () => {
  it('lists several chiefs once each', () => {
    expect(chiefsOf('Kepala, Ketua ; Kepala')).toEqual(['Kepala', 'Ketua']);
    expect(chiefsOf('')).toEqual([]);
  });

  it('junior: override > Junior line > floor nickname > derived; chief: override > message > the single floor chief', () => {
    const one = { ...FLOOR, chiefs: 'Kepala' };
    const two = { ...FLOOR, chiefs: 'Kepala, Ketua' };
    expect(effective(rostered(), one, '2026-10-12')).toMatchObject({ junior: 'Dani', chief: 'Kepala' });
    expect(effective(rostered(), two, '2026-10-12').chief).toBe('');
    expect(effective(rostered({ junior: 'Muda', chief: 'Lain' }), one, '2026-10-12')).toMatchObject({ junior: 'Muda', chief: 'Lain' });
    expect(effective(rostered({ sender: 'x', senderNick: 'Xe' }), FLOOR, '2026-10-12').junior).toBe('Xe');
    expect(effective(rostered({ junior: 'Muda' }, { junior: 'Ganti', chief: 'Ketua' }), two, '2026-10-12')).toMatchObject({
      junior: 'Ganti',
      chief: 'Ketua',
    });
  });
});

describe('colourOn (set by hand, never read from the SOAP)', () => {
  it('a hand mark wins; else the planned date: red the day before, green on and after', () => {
    expect(colourOn({ colour: 'h1', dischargeDate: '' }, '2026-10-12')).toBe('tomorrow');
    expect(colourOn({ colour: 'today', dischargeDate: '2026-10-20' }, '2026-10-12')).toBe('today');
    const planned = { colour: 'none' as const, dischargeDate: '2026-10-14' };
    expect(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'].map((d) => colourOn(planned, d))).toEqual([
      null, 'tomorrow', 'today', 'today',
    ]);
  });

  it('a SOAP saying "pulang hari ini" does not colour the patient', () => {
    expect(effective(rostered({ body: 'Plan:\n- Pulang hari ini' }), FLOOR, '2026-10-12').discharge).toBeNull();
  });
});

describe('rosterView', () => {
  it('only patients still dirawat are on the list; who left is listed newest first', () => {
    const roster = [
      rostered({ key: 'rm:1' }),
      rostered({ key: 'rm:2' }, { status: 'pulang', leftAt: '2026-10-12T05:00' }),
      rostered({ key: 'rm:3' }, { status: 'pindah', pindahKe: 'ICU', leftAt: '2026-10-12T09:00' }),
    ];
    const view = rosterView(FLOOR, roster, '2026-10-12');
    expect(view.active.map((p) => p.key)).toEqual(['rm:1']);
    expect(view.left.map((p) => p.key)).toEqual(['rm:3', 'rm:2']);
  });
});

describe('suggestionFor (a chip, never applied by itself)', () => {
  it('offers what the Plan says, relative to the day the SOAP was sent', () => {
    expect(suggestionFor(rostered({ body: 'Plan:\n- Usul H-1 hari ini' }), '2026-10-12')).toBe('h1');
    // Written yesterday, "H-1" means today.
    expect(suggestionFor(rostered({ body: 'Plan:\n- Usul H-1 hari ini', sentAt: '2026-10-11T07:00' }), '2026-10-12')).toBe('today');
    // Yesterday's "pulang hari ini" is stale: nothing.
    expect(suggestionFor(rostered({ body: 'Plan:\n- Pulang hari ini', sentAt: '2026-10-11T07:00' }), '2026-10-12')).toBeNull();
    expect(suggestionFor(rostered({ body: 'Diagnosis:\n- post PPM (H-1)' }), '2026-10-12')).toBeNull();
  });

  it('not offered once dismissed for this SOAP, when already set, or for who left', () => {
    const body = 'Plan:\n- Pulang hari ini';
    expect(suggestionFor(rostered({ body }, { dismissed: '2026-10-12T07:00' }), '2026-10-12')).toBeNull();
    expect(suggestionFor(rostered({ body }, { colour: 'today' }), '2026-10-12')).toBeNull();
    expect(suggestionFor(rostered({ body }, { status: 'pulang' }), '2026-10-12')).toBeNull();
    // A newer SOAP after a dismissal is offered again.
    expect(suggestionFor(rostered({ body, sentAt: '2026-10-12T09:00' }, { dismissed: '2026-10-12T07:00' }), '2026-10-12')).toBe('today');
  });
});

describe('division patients (13.9)', () => {
  const one = { ...FLOOR, chiefs: 'Kepala' };

  it('"KJS ARITMIA" in the identity: held by the division, no ward junior or chief', () => {
    const entry = rostered({ identity: 'Ny. Contoh / RM 00554408 - KJS ARITMIA', junior: '', senderNick: '' });
    expect(divisionOf(entry)).toBe('Aritmia');
    expect(effective(entry, one, '2026-10-12')).toMatchObject({ division: 'Aritmia', junior: '', chief: '' });
  });

  it('set by hand either way; KJS BTKV is not a division', () => {
    expect(divisionOf(rostered({}, { division: 'Intervensi' }))).toBe('Intervensi');
    expect(divisionOf(rostered({ identity: 'X - KJS Aritmia' }, { division: '-' }))).toBe('');
    expect(effective(rostered({ identity: 'X - KJS Aritmia' }, { division: '-' }), one, '2026-10-12')).toMatchObject({ chief: 'Kepala' });
    expect(divisionOf(rostered({ identity: 'Tn. Contoh (KJS BTKV)' }))).toBe('');
  });
});

describe('floor marks (13.7)', () => {
  const marks = [{ id: 'k1', label: 'Pre-op', color: 'purple' as const }];

  it('a mark set by hand is shown with its label and colour, and wins over the planned date', () => {
    const entry = rostered({ key: 'rm:1' }, { colour: 'm:k1', dischargeDate: '2026-10-12' });
    const seen = effective(entry, { ...FLOOR, marks }, '2026-10-12');
    expect(seen.mark).toEqual({ label: 'Pre-op', color: 'purple' });
    expect(seen.discharge).toBeNull();
  });

  it('a mark the floor deleted shows nothing; red/green carry no mark', () => {
    expect(effective(rostered({ key: 'rm:1' }, { colour: 'm:k9' }), { ...FLOOR, marks }, '2026-10-12').mark).toBeUndefined();
    expect(effective(rostered({ key: 'rm:1' }, { colour: 'h1' }), { ...FLOOR, marks }, '2026-10-12')).toMatchObject({ discharge: 'tomorrow' });
    expect(effective(rostered({ key: 'rm:1' }, { colour: 'h1' }), { ...FLOOR, marks }, '2026-10-12').mark).toBeUndefined();
  });
});

describe('pasteDiff (nobody is removed by a paste)', () => {
  const roster = [
    rostered({ key: 'rm:1', sentAt: '2026-10-11T07:00', full: 'a' }),
    rostered({ key: 'rm:2', rm: '2', room: '418', sentAt: '2026-10-11T07:00' }, { status: 'pindah', pindahKe: 'ICU' }),
  ];

  it('new patients are proposed, newer SOAPs update, a patient who left is only offered back', () => {
    const later = patient({ key: 'rm:1', sentAt: '2026-10-12T07:00', full: 'b' });
    const fresh = patient({ key: 'rm:9', rm: '9', sentAt: '2026-10-12T08:00' });
    const back = patient({ key: 'rm:2', rm: '2', room: '418', sentAt: '2026-10-12T07:00' });
    const diff = pasteDiff(roster, [later, fresh, back]);
    expect(diff.fresh.map((p) => p.key)).toEqual(['rm:9']);
    expect(diff.updated.map((u) => u.report.full)).toEqual(['b']);
    expect(diff.readmit.map((r) => r.before.key)).toEqual(['rm:2']);
    expect(diff.moved).toEqual([]);
  });

  it('the latest report within one paste counts; the same or an older one changes nothing', () => {
    const older = patient({ key: 'rm:1', sentAt: '2026-10-10T07:00' });
    const same = patient({ key: 'rm:1', sentAt: '2026-10-11T07:00', full: 'a' });
    expect(pasteDiff(roster, [older, same]).unchanged).toBe(1);
    const twice = pasteDiff([], [patient({ key: 'rm:5', sentAt: '2026-10-12T09:00', full: 'x' }), patient({ key: 'rm:5', sentAt: '2026-10-12T07:00' })]);
    expect(twice.fresh.map((p) => p.full)).toEqual(['x']);
  });

  it('a room/bed change is flagged; kept unless the move is confirmed', () => {
    const moved = patient({ key: 'rm:1', room: '420', bed: '2', sentAt: '2026-10-12T07:00' });
    const diff = pasteDiff(roster, [moved]);
    expect(diff.moved.map((m) => m.report.room)).toEqual(['420']);
    expect(updatedReport(roster[0]!.report, moved, false)).toMatchObject({ room: '417', bed: '1', sentAt: '2026-10-12T07:00' });
    expect(updatedReport(roster[0]!.report, moved, true)).toMatchObject({ room: '420', bed: '2' });
  });

  it('a room/bed set by hand is not undone by a SOAP written before it; a later SOAP with another room asks again', () => {
    const placed = [rostered({ key: 'rm:1', room: '419', bed: '3', sentAt: '2026-10-12T07:00' }, { placedAt: '2026-10-12T10:00' })];
    const stale = patient({ key: 'rm:1', room: '417', bed: '1', sentAt: '2026-10-12T09:00', full: 'b' });
    const stalediff = pasteDiff(placed, [stale]);
    expect(stalediff.moved).toEqual([]);
    expect(updatedReport(placed[0]!.report, stale, false)).toMatchObject({ room: '419', bed: '3' });
    const later = patient({ key: 'rm:1', room: '420', bed: '1', sentAt: '2026-10-12T11:00', full: 'c' });
    expect(pasteDiff(placed, [later]).moved).toHaveLength(1);
  });

  it('an edit (Ubah SOAP) survives a re-paste of the same message; a newer message replaces it', () => {
    const edited = [rostered({ key: 'rm:1', sentAt: '2026-10-12T07:00', full: 'diubah', edited: true })];
    expect(pasteDiff(edited, [patient({ key: 'rm:1', sentAt: '2026-10-12T07:00', full: 'asli' })]).unchanged).toBe(1);
    expect(pasteDiff(edited, [patient({ key: 'rm:1', sentAt: '2026-10-12T09:00', full: 'baru' })]).updated).toHaveLength(1);
  });

  it('a list line never replaces a stored SOAP; a SOAP replaces a stored list line even if older', () => {
    const soap = [rostered({ key: 'rm:1', sentAt: '2026-10-12T07:00', full: 'soap' })];
    expect(pasteDiff(soap, [patient({ key: 'rm:1', sentAt: '2026-10-12T09:00', full: 'list', fromList: true })]).unchanged).toBe(1);
    const listed = [rostered({ key: 'rm:1', sentAt: '2026-10-12T09:00', full: 'list', fromList: true })];
    expect(pasteDiff(listed, [patient({ key: 'rm:1', sentAt: '2026-10-12T07:00', full: 'soap' })]).updated).toHaveLength(1);
  });

  it('a new patient who has probably gone already is flagged (unticked), with the reason', () => {
    const today = patient({ key: 'rm:10', rm: '10', sentAt: '2026-10-13T07:00' });
    const wentHome = patient({ key: 'rm:11', rm: '11', sentAt: '2026-10-12T07:00', body: 'Plan:\n- Rawat jalan hari ini' });
    const saidH1 = patient({ key: 'rm:12', rm: '12', sentAt: '2026-10-11T07:00', body: 'Plan:\n- Usul H-1' });
    const silent = patient({ key: 'rm:13', rm: '13', sentAt: '2026-10-11T06:00' });
    const yesterday = patient({ key: 'rm:14', rm: '14', sentAt: '2026-10-12T07:00' });
    const diff = pasteDiff([], [today, wentHome, saidH1, silent, yesterday]);
    expect(diff.fresh).toHaveLength(5);
    expect(diff.doubt).toEqual({ 'rm:11': 'plan pulang 12/10', 'rm:12': 'plan pulang 12/10', 'rm:13': 'SOAP terakhir 11/10' });
  });

  it('a newer sent list decides: missing from it → doubtful, on it → kept whatever the SOAP said', () => {
    const wentHome = patient({ key: 'rm:11', rm: '11', sentAt: '2026-10-12T07:00', body: 'Plan:\n- Pulang hari ini' });
    const stays = patient({ key: 'rm:15', rm: '15', sentAt: '2026-10-12T07:00', body: 'Plan:\n- Pulang hari ini' });
    const quiet = patient({ key: 'rm:16', rm: '16', sentAt: '2026-10-12T20:00' });
    // The list goes out in two messages a few minutes apart: one list.
    const listA = patient({ key: 'rm:15', rm: '15', sentAt: '2026-10-13T04:00', fromList: true });
    const listB = patient({ key: 'rm:17', rm: '17', sentAt: '2026-10-13T04:05', fromList: true });
    const diff = pasteDiff([], [wentHome, stays, quiet, listA, listB]);
    expect(diff.doubt).toEqual({ 'rm:11': 'tidak ada di list 13/10 04:05', 'rm:16': 'tidak ada di list 13/10 04:05' });
    // A SOAP written after the list is not judged by it.
    const after = patient({ key: 'rm:18', rm: '18', sentAt: '2026-10-13T07:00' });
    expect(pasteDiff([], [listA, after]).doubt).toEqual({});
  });

  it('a hand-entered patient is not overwritten by a paste', () => {
    const manual = [rostered({ key: 'rm:77', sentAt: '2026-10-10T08:00', manual: true })];
    expect(pasteDiff(manual, [patient({ key: 'rm:77', sentAt: '2026-10-12T07:00', full: 'soap' })]).unchanged).toBe(1);
  });
});

describe('leftSince / leftNote', () => {
  it('lists who left since the last edition, oldest first, without residents', () => {
    const roster = [
      rostered({ key: 'rm:1' }),
      rostered({ key: 'rm:2', name: 'Tn. Dua' }, { status: 'pulang', leftAt: '2026-10-12T05:00' }),
      rostered({ key: 'rm:3', name: 'Tn. Tiga' }, { status: 'pindah', pindahKe: 'CVCU', leftAt: '2026-10-12T09:00' }),
      rostered({ key: 'rm:4', name: 'Tn. Empat' }, { status: 'pulang', leftAt: '2026-10-11T20:00' }),
    ];
    const left = leftSince(roster, '2026-10-12T04:00');
    expect(left.map((p) => p.key)).toEqual(['rm:2', 'rm:3']);
    expect(localStamp(new Date(2026, 9, 12, 7, 5))).toBe('2026-10-12T07:05');
    const note = leftNote(left, (p) => `${p.room}/${p.name}${p.junior ? ` - ${p.junior}` : ''}`);
    expect(note).toBe('Pulang: 417/Tn. Dua\nPindah ke CVCU: 417/Tn. Tiga');
  });
});

describe('rosterName / the junior roster (12.12)', () => {
  const roster = ['Kirana', 'Gemilang', 'Sekar', 'Sekti', 'Danu', 'Dana'];

  it('matches spacing, case, one-letter typos and short forms to the roster spelling', () => {
    expect(rosterName('Kiran A', roster)).toBe('Kirana');
    expect(rosterName('kirana', roster)).toBe('Kirana');
    expect(rosterName('Gemilan', roster)).toBe('Gemilang');
    expect(rosterName('Gemillang', roster)).toBe('Gemilang');
    expect(rosterName('Gem', roster)).toBe('Gemilang');
  });

  it('keeps the name as written when nothing or more than one roster name fits', () => {
    expect(rosterName('Yoga', roster)).toBe('Yoga');
    expect(rosterName('Sek', roster)).toBe('Sek');
    expect(rosterName('Danu', roster)).toBe('Danu');
    expect(rosterName('Kiran A', [])).toBe('Kiran A');
  });

  it('effective() shows the roster spelling for the junior and the chief', () => {
    const floor = { ...FLOOR, chiefs: 'Kepala', juniors: 'Kirana, Sekar' };
    expect(effective(rostered({ junior: 'Kiran A', chief: 'kepala' }), floor, '2026-10-12')).toMatchObject({ junior: 'Kirana', chief: 'Kepala' });
    expect(effective(rostered({ junior: 'Kiran A' }), FLOOR, '2026-10-12').junior).toBe('Kiran A');
  });
});
