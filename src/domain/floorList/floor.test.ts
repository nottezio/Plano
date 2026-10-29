import { describe, expect, it } from 'vitest';

import {
  canEdit,
  chiefsOf,
  clearMarkFields,
  colourChoice,
  colourFields,
  colourMark,
  colourOn,
  divisionOf,
  effective,
  holderLabel,
  isOwner,
  leftNote,
  leftSince,
  legacyColourDate,
  localOf,
  localStamp,
  newRosterPatient,
  pasteDiff,
  rosterName,
  rosterView,
  soapState,
  suggestionActions,
  suggestionFor,
  updatedReport,
  usulDays,
  usulFields,
  usulMarkFields,
  usulOpen,
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
  chiefBangsal: '',
  juniors: '',
  marks: [],
  analysisTitles: {},
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

  it('a hand mark is a date: H-1 set on the 12th is red on the 12th and green on the 13th', () => {
    const h1 = colourFields('h1', '2026-10-12');
    expect(['2026-10-12', '2026-10-13', '2026-10-14'].map((d) => colourOn(h1, d))).toEqual(['tomorrow', 'today', 'today']);
    expect(colourMark(h1, '2026-10-12')).toBe('h1');
    expect(colourMark(h1, '2026-10-13')).toBe('today');
    expect(colourOn(colourFields('today', '2026-10-12'), '2026-10-12')).toBe('today');
    expect(colourOn(colourFields('none', '2026-10-12'), '2026-10-12')).toBeNull();
  });

  it('a mark stored the old way (colour, no date) is dated from the log', () => {
    const log = [
      { at: '2026-10-12T02:00:00.000Z', by: 'A', what: 'Masuk list' },
      { at: '2026-10-12T05:00:00.000Z', by: 'A', what: 'H-1 (merah)' },
    ];
    const day = localOf(log[1]!.at).slice(0, 10);
    expect(legacyColourDate('h1', log)).toBe(colourFields('h1', day).dischargeDate);
    expect(legacyColourDate('today', log)).toBe(day);
    expect(legacyColourDate('h1', [log[0]!])).toBe('');
    expect(legacyColourDate('none', log)).toBe('');
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
    expect(suggestionFor(rostered({ body: 'Plan:\n- H-1 hari ini' }), '2026-10-12')).toBe('h1');
    // Written yesterday, "H-1" means today.
    expect(suggestionFor(rostered({ body: 'Plan:\n- H-1 hari ini', sentAt: '2026-10-11T07:00' }), '2026-10-12')).toBe('today');
    // Yesterday's "pulang hari ini" is stale: nothing.
    expect(suggestionFor(rostered({ body: 'Plan:\n- Pulang hari ini', sentAt: '2026-10-11T07:00' }), '2026-10-12')).toBeNull();
    // Yesterday's SOAP edited today to "H-1 hari ini": tomorrow, not today (29 Oct 2026).
    expect(suggestionFor(rostered({ body: 'Plan:\n- H-1 hari ini', sentAt: '2026-10-11T07:00', edited: true, editedAt: '2026-10-12T08:00' }), '2026-10-12')).toBe('h1');
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

describe('usul H-1 (26 Oct 2026): a proposal the supervisor has not accepted yet', () => {
  const usul = 'Plan:\n- Usul H-1 hari ini';

  it('is its own suggestion, not H-1, whatever day the SOAP was sent', () => {
    expect(suggestionFor(rostered({ body: usul }), '2026-10-12')).toBe('usul');
    expect(suggestionFor(rostered({ body: usul, sentAt: '2026-10-10T07:00' }), '2026-10-12')).toBe('usul');
  });

  it('not offered again once marked, dismissed, already coloured, or for who left', () => {
    expect(suggestionFor(rostered({ body: usul }, { usulH1: '2026-10-12' }), '2026-10-12')).toBeNull();
    expect(suggestionFor(rostered({ body: usul }, { dismissed: '2026-10-12T07:00' }), '2026-10-12')).toBeNull();
    expect(suggestionFor(rostered({ body: usul }, { dischargeDate: '2026-10-13' }), '2026-10-12')).toBeNull();
    expect(suggestionFor(rostered({ body: usul }, { status: 'pindah' }), '2026-10-12')).toBeNull();
  });

  it('the accepting SOAP ("H-1 hari ini") is the normal H-1 chip, and stays offered while usul is open', () => {
    const accepted = { body: 'Plan:\n- H-1 hari ini', sentAt: '2026-10-13T07:00' };
    expect(suggestionFor(rostered(accepted, { usulH1: '2026-10-12' }), '2026-10-13')).toBe('h1');
  });

  it('is open while marked and not coloured; marking H-1 or pulang closes it', () => {
    expect(usulOpen(rostered({}, { usulH1: '2026-10-12' }))).toBe(true);
    expect(usulOpen(rostered({}, { usulH1: '' }))).toBe(false);
    expect(usulOpen(rostered({}, { usulH1: '2026-10-12', status: 'pulang' }))).toBe(false);
    expect(usulFields('2026-10-12')).toEqual({ usulH1: '2026-10-12' });
    expect(colourFields('h1', '2026-10-13')).toEqual({ colour: 'none', dischargeDate: '2026-10-14', usulH1: '' });
    expect(colourFields('today', '2026-10-13')).toEqual({ colour: 'none', dischargeDate: '2026-10-13', usulH1: '' });
    // "Tanpa warna" says nothing about the proposal.
    expect(colourFields('none', '2026-10-13')).toEqual({ colour: 'none', dischargeDate: '' });
  });

  it('the Warna select has Usul H-1 as its own choice (26 Oct 2026)', () => {
    const day = '2026-10-13';
    // Usul marks and clears the date colour; the select reads it back as 'usul'.
    expect(usulMarkFields(day)).toEqual({ colour: 'none', dischargeDate: '', usulH1: day });
    const asUsul = rostered({}, { ...usulMarkFields(day) });
    expect(colourChoice(asUsul, day)).toBe('usul');
    // A decision wins: coloured is never shown as usul, and closes the usul.
    expect(colourChoice(rostered({}, { ...colourFields('h1', day) }), day)).toBe('h1');
    expect(colourChoice(rostered({}, { ...colourFields('today', day) }), day)).toBe('today');
    // "Tanpa warna" picked by hand clears the usul too, so the select can leave 'usul'.
    expect(clearMarkFields()).toEqual({ colour: 'none', dischargeDate: '', usulH1: '' });
    expect(colourChoice(rostered({}, { ...clearMarkFields() }), day)).toBe('none');
    // A patient who went home has no open usul to show.
    expect(colourChoice(rostered({}, { ...usulMarkFields(day), status: 'pulang' }), day)).toBe('none');
  });

  it('the chip offers the right answers for each reading of the Plan', () => {
    const day = '2026-10-13';
    const labels = (mark: 'h1' | 'today' | 'usul', state: Partial<RosterPatient> = {}) => suggestionActions(rostered({}, state), mark, day).map((a) => a.label);
    // A first usul: record it, or say it is already certain.
    expect(labels('usul')).toEqual(['Tandai usul', 'Sudah pasti H-1']);
    expect(suggestionActions(rostered(), 'usul', day)[0]).toMatchObject({ fields: { usulH1: day }, what: 'Usul H-1 (dari saran Plan)' });
    // The accepting SOAP while an usul is open.
    expect(labels('h1', { usulH1: '2026-10-12' })).toEqual(['Usul disetujui — tandai H-1']);
    expect(suggestionActions(rostered({}, { usulH1: '2026-10-12' }), 'h1', day)[0]).toMatchObject({
      fields: { dischargeDate: '2026-10-14', usulH1: '' },
      what: 'H-1 (usul disetujui)',
    });
    // Without an usul the chips are as before.
    expect(labels('h1')).toEqual(['Tandai']);
    expect(labels('today')).toEqual(['Tandai']);
    expect(suggestionActions(rostered(), 'today', day)[0]).toMatchObject({ fields: { dischargeDate: day, usulH1: '' }, what: 'Pulang hari ini (dari saran Plan)' });
  });

  it('days open count from the day it was marked', () => {
    expect(usulDays(rostered({}, { usulH1: '2026-10-12' }), '2026-10-12')).toBe(0);
    expect(usulDays(rostered({}, { usulH1: '2026-10-12' }), '2026-10-15')).toBe(3);
    expect(usulDays(rostered({}), '2026-10-15')).toBeNull();
  });

  it('shows on the list line as a flag only while open', () => {
    const open = rostered({}, { usulH1: '2026-10-12' });
    expect(effective(open, FLOOR, '2026-10-12', false).usul).toBe(true);
    expect(effective(rostered(), FLOOR, '2026-10-12', false).usul).toBeUndefined();
  });
});

describe('division patients (13.9, 13.10)', () => {
  const one = { ...FLOOR, chiefs: 'Kepala' };
  const listed = { fromList: true as const, junior: '', senderNick: '' };

  it('a sent-list line "- KJS ARITMIA" with no ward junior: held by the division, no ward junior or chief', () => {
    const entry = rostered({ ...listed, identity: 'Ny. Contoh / RM 00554408 - KJS ARITMIA' });
    expect(divisionOf(entry)).toBe('Aritmia');
    expect(effective(entry, one, '2026-10-12')).toMatchObject({ division: 'Aritmia', junior: '', chief: '' });
  });

  it('a SOAP from the floor group, or a junior written: the ward follows it (a ZD patient with a KJS Aritmia consult)', () => {
    expect(divisionOf(rostered({ identity: 'Tn. Contoh', full: 'DPJP KJS Aritmia: Prof. X' }))).toBe('');
    expect(divisionOf(rostered({ ...listed, junior: 'Bima', identity: 'Tn. Contoh (KJS Aritmia)' }))).toBe('');
  });

  it('only a consultant DPJP (utama of another department), from a list: held as KJS', () => {
    expect(divisionOf(rostered({ ...listed, dpjpId: null, kjsDpjpIds: ['mz'] }))).toBe('KJS');
    expect(holderLabel('KJS')).toBe('KJS');
    expect(holderLabel('Aritmia')).toBe('Divisi Aritmia');
  });

  it('held by a division: the DPJP on the line is the consultant — filed as that DPJP\'s KJS, code still printed (13.14)', () => {
    const seen = effective(rostered({ ...listed, dpjpId: 'mz', identity: 'Ny. Contoh / RM 1 - KJS ARITMIA' }), one, '2026-10-12');
    expect(seen).toMatchObject({ dpjpId: null, kjsDpjpIds: ['mz'], dpjpCode: 'MZ', division: 'Aritmia' });
    // A ward patient (a SOAP from the group) keeps its own DPJP.
    expect(effective(rostered({ dpjpId: 'mz' }), one, '2026-10-12')).toMatchObject({ dpjpId: 'mz', kjsDpjpIds: [] });
  });

  it('set by hand either way; KJS BTKV is not a division', () => {
    expect(divisionOf(rostered({}, { division: 'Intervensi' }))).toBe('Intervensi');
    expect(divisionOf(rostered({ ...listed, identity: 'X - KJS Aritmia' }, { division: '-' }))).toBe('');
    expect(effective(rostered({ ...listed, identity: 'X - KJS Aritmia' }, { division: '-' }), one, '2026-10-12')).toMatchObject({ chief: 'Kepala' });
    expect(divisionOf(rostered({ ...listed, identity: 'Tn. Contoh (KJS BTKV)' }))).toBe('');
  });
});

describe('floor tags (13.10)', () => {
  const marks = [
    { id: 'k1', label: 'Pre-op', color: 'purple' as const },
    { id: 'k2', label: 'Pasien NP', color: 'teal' as const, auto: { kind: 'dpjp' as const, ids: ['np'] } },
    { id: 'k3', label: 'Baru', color: 'blue' as const, auto: { kind: 'baru' as const } },
  ];
  const floor = { ...FLOOR, marks };

  it('a tag never colours the line: an H-1 patient keeps red and carries its tag', () => {
    const seen = effective(rostered({ key: 'rm:1' }, { colour: 'h1', tags: ['k1'] }), floor, '2026-10-12');
    expect(seen.discharge).toBe('tomorrow');
    expect(seen.tags).toEqual([{ label: 'Pre-op', color: 'purple' }]);
  });

  it('rules: the DPJP\'s patients and new patients get the tag by themselves; turned off per patient', () => {
    expect(effective(rostered({ dpjpId: 'np' }), floor, '2026-10-12').tags?.map((t) => t.label)).toEqual(['Pasien NP']);
    expect(effective(rostered({ dpjpId: 'np' }), floor, '2026-10-12', true).tags?.map((t) => t.label)).toEqual(['Pasien NP', 'Baru']);
    expect(effective(rostered({ dpjpId: 'np' }, { tagsOff: ['k2'] }), floor, '2026-10-12').tags).toBeUndefined();
  });

  it('new = not on the last list before this date; without one, added on this date', () => {
    const fresh = rostered({ key: 'rm:5', rm: '5' }, { addedAt: '2026-10-12T03:00:00.000Z' });
    const old = rostered({ key: 'rm:6', rm: '6' }, { addedAt: '2026-10-10T03:00:00.000Z' });
    const label = (v: ReturnType<typeof rosterView>, key: string) => v.active.find((p) => p.key === key)?.tags?.map((t) => t.label) ?? [];
    const plain = rosterView(floor, [fresh, old], '2026-10-12');
    expect([label(plain, 'rm:5'), label(plain, 'rm:6')]).toEqual([['Baru'], []]);
    const sent = rosterView(floor, [fresh, old], '2026-10-12', new Set(['rm:5']));
    expect([label(sent, 'rm:5'), label(sent, 'rm:6')]).toEqual([[], ['Baru']]);
  });

  it('"added on this date" is the local date: 04:30 WITA is 20:30 UTC the day before (2026-10-16)', () => {
    // An ISO time whose LOCAL clock reads 04:30 on the list date, whatever zone the tests run in.
    const early = rostered({ key: 'rm:7', rm: '7' }, { addedAt: new Date('2026-10-12T04:30:00').toISOString() });
    const view = rosterView(floor, [early], '2026-10-12');
    expect(view.active[0]!.tags?.map((t) => t.label)).toEqual(['Baru']);
  });

  it('a mark the floor deleted shows nothing', () => {
    expect(effective(rostered({}, { tags: ['k9'] }), floor, '2026-10-12').tags).toBeUndefined();
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
    const back = patient({ key: 'rm:2', rm: '2', room: '418', sentAt: '2026-10-12T07:00', full: 'SOAP baru' });
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
    const saidH1 = patient({ key: 'rm:12', rm: '12', sentAt: '2026-10-11T07:00', body: 'Plan:\n- Rencana H-1' });    const silent = patient({ key: 'rm:13', rm: '13', sentAt: '2026-10-11T06:00' });
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

  it('a SOAP replaces a hand-entered patient; a list line does not (13.11)', () => {
    const manual = [rostered({ key: 'rm:77', sentAt: '2026-10-12T08:00', manual: true })];
    expect(pasteDiff(manual, [patient({ key: 'rm:77', sentAt: '2026-10-12T07:00', full: 'soap' })]).updated).toHaveLength(1);
    expect(pasteDiff(manual, [patient({ key: 'rm:77', sentAt: '2026-10-12T09:00', full: 'list', fromList: true })]).unchanged).toBe(1);
  });

  it('a hand entry without RM is found by name in its room, and by RM once it has one (13.13)', () => {
    const hand = rostered({ key: 'manual:421:contoh-anak', rm: '', name: 'An. Contoh Anak', room: '421', bed: '6', manual: true, sentAt: '2026-10-12T08:00' });
    const soap = patient({ key: 'rm:1516148', rm: '1516148', name: 'An. Contoh Anak', room: '421', bed: '6', sentAt: '2026-10-13T07:00', full: 'soap' });
    const diff = pasteDiff([hand], [soap]);
    expect(diff.fresh).toEqual([]);
    expect(diff.updated.map((u) => u.before.key)).toEqual(['manual:421:contoh-anak']);
    // Updated, it keeps its first key; the next SOAP is found by RM.
    const after = { ...hand, report: { ...soap, key: hand.key, manual: undefined } };
    expect(pasteDiff([after], [{ ...soap, sentAt: '2026-10-14T07:00', full: 'soap 2' }]).updated).toHaveLength(1);
    // Another room, or a list line: not the same patient by name alone.
    expect(pasteDiff([hand], [{ ...soap, room: '417' }]).fresh).toHaveLength(1);
    expect(pasteDiff([hand], [{ ...soap, fromList: true }]).fresh).toHaveLength(1);
  });

  it('the same text again changes nothing, whatever its time (a copied message is stamped "now")', () => {
    const stored = [rostered({ key: 'rm:1', sentAt: '2026-10-12T07:00', full: 'sama' })];
    expect(pasteDiff(stored, [patient({ key: 'rm:1', sentAt: '2026-10-13T14:10', full: 'sama' })]).unchanged).toBe(1);
  });

  it('an update with no sender keeps the stored sender (the junior read from it stays)', () => {
    const stored = patient({ sender: 'dr. Muh Bima Contoh', senderNick: 'Bima' });
    expect(updatedReport(stored, patient({ sender: '', senderNick: '', full: 'baru' }), true)).toMatchObject({ sender: 'dr. Muh Bima Contoh', senderNick: 'Bima', full: 'baru' });
  });
});

describe('soapState (13.11)', () => {
  it('"baru" after the last sent list; "lama" when none yet on the list date; nothing for hand entries and list lines', () => {
    expect(soapState(patient({ sentAt: '2026-10-13T11:20' }), '2026-10-13', '2026-10-13T04:05')).toBe('baru');
    expect(soapState(patient({ sentAt: '2026-10-13T03:50' }), '2026-10-13', '2026-10-13T04:05')).toBeNull();
    expect(soapState(patient({ sentAt: '2026-10-12T07:00' }), '2026-10-13', '2026-10-13T04:05')).toBe('lama');
    // "Ubah SOAP" keeps the message's sentAt; the edit time is what makes it current (2026-10-25, Tn. Irwan).
    expect(soapState(patient({ sentAt: '2026-10-12T07:00', edited: true, editedAt: '2026-10-13T11:20' }), '2026-10-13', '2026-10-13T04:05')).toBe('baru');
    expect(soapState(patient({ sentAt: '2026-10-12T07:00', edited: true, editedAt: '2026-10-13T03:00' }), '2026-10-13', '2026-10-13T04:05')).toBeNull();
    expect(soapState(patient({ sentAt: '2026-10-12T07:00', manual: true }), '2026-10-13', '')).toBeNull();
    expect(soapState(patient({ sentAt: '2026-10-13T09:00', fromList: true }), '2026-10-13', '2026-10-13T04:05')).toBeNull();
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
