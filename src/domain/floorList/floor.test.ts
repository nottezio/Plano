import { describe, expect, it } from 'vitest';

import { canEdit, chiefsOf, dayView, emptyDay, isOwner, pastePlan, withEdits, type FloorDay, type FloorDoc } from './floor';
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
  manual: {},
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

function day(date: string, patients: FloorPatient[], over: Partial<FloorDay> = {}): FloorDay {
  return { ...emptyDay(date), ...over, patients: Object.fromEntries(patients.map((p) => [p.key, p])) };
}

describe('roles', () => {
  it('owner and edit members edit; view members do not; outsiders do not', () => {
    expect([canEdit(FLOOR, 'owner'), canEdit(FLOOR, 'ed'), canEdit(FLOOR, 'vi'), canEdit(FLOOR, 'x'), canEdit(FLOOR, null)]).toEqual([
      true, true, false, false, false,
    ]);
    expect(isOwner(FLOOR, 'ed')).toBe(false);
  });
});

describe('withEdits', () => {
  it('junior: edit > Junior line > floor nickname > derived; chief: edit > message > day chief', () => {
    const d = emptyDay('2026-10-12');
    d.chief = 'Kepala';
    expect(withEdits(patient({}), FLOOR, d)).toMatchObject({ junior: 'Dani', chief: 'Kepala' });
    expect(withEdits(patient({ junior: 'Muda', chief: 'Lain' }), FLOOR, d)).toMatchObject({ junior: 'Muda', chief: 'Lain' });
    expect(withEdits(patient({ sender: 'x', senderNick: 'Xe' }), FLOOR, d).junior).toBe('Xe');
    d.edits['rm:1'] = { junior: 'Ganti', chief: 'Ganti2', discharge: 'tomorrow' };
    expect(withEdits(patient({ junior: 'Muda' }), FLOOR, d)).toMatchObject({ junior: 'Ganti', chief: 'Ganti2', discharge: 'tomorrow' });
    d.edits['rm:1'] = { discharge: 'none' };
    expect(withEdits(patient({ discharge: 'today' }), FLOOR, d).discharge).toBeNull();
  });
});

describe('dayView', () => {
  const a1 = patient({ key: 'rm:1', sentAt: '2026-10-11T07:00', body: 'lama' });
  const a2 = patient({ key: 'rm:1', sentAt: '2026-10-12T07:00', body: 'baru' });
  const b = patient({ key: 'rm:2', rm: '2', room: '418', sentAt: '2026-10-11T07:00', discharge: 'today' });
  const c = patient({ key: 'rm:3', rm: '3', room: '419', sentAt: '2026-10-10T07:00' });
  const old = patient({ key: 'rm:4', rm: '4', room: '401', sentAt: '2026-10-08T07:00' });
  const days = [day('2026-10-08', [old]), day('2026-10-10', [c]), day('2026-10-11', [a1, b]), day('2026-10-12', [a2])];

  it('reads D-2…D, keeps the latest report, and drops who went home or went quiet', () => {
    const view = dayView(FLOOR, days, '2026-10-12');
    expect(view.present.map((p) => [p.key, p.body])).toEqual([['rm:1', 'baru']]);
    expect(view.gone.map((g) => [g.patient.key, g.reason]).sort()).toEqual([
      ['rm:2', 'pulang'],
      ['rm:3', 'tanpa-laporan'],
    ]);
  });

  it('keep puts a dropped patient back; hidden takes one off', () => {
    const withEditsDay = day('2026-10-12', [a2], { edits: { 'rm:3': { keep: true }, 'rm:1': { hidden: true } } });
    const view = dayView(FLOOR, [...days.slice(0, 3), withEditsDay], '2026-10-12');
    expect(view.present.map((p) => p.key)).toEqual(['rm:3']);
    expect(view.hidden.map((p) => p.key)).toEqual(['rm:1']);
    expect(view.gone.map((g) => g.patient.key)).toEqual(['rm:2']);
  });
});

describe('pastePlan', () => {
  const stored = [day('2026-10-11', [patient({ key: 'rm:1', sentAt: '2026-10-11T07:00', full: 'a' })])];

  it('files new and later reports under their sent date; the same paste twice writes nothing', () => {
    const later = patient({ key: 'rm:1', sentAt: '2026-10-12T07:00', full: 'b' });
    const fresh = patient({ key: 'rm:9', sentAt: '2026-10-12T08:00' });
    const plan = pastePlan(stored, [later, fresh], '2026-10-12');
    expect([plan.added, plan.updated, plan.unchanged]).toEqual([1, 1, 0]);
    expect(plan.byDate.get('2026-10-12')?.map((p) => p.key)).toEqual(['rm:1', 'rm:9']);
    const again = pastePlan([...stored, day('2026-10-12', [later, fresh])], [later, fresh], '2026-10-12');
    expect([again.added, again.updated, again.unchanged, again.byDate.size]).toEqual([0, 0, 2, 0]);
  });

  it('an older report than the stored one is not filed; undated reports go to the list date', () => {
    const older = patient({ key: 'rm:1', sentAt: '2026-10-10T07:00' });
    expect(pastePlan(stored, [older], '2026-10-12').unchanged).toBe(1);
    const undated = patient({ key: 'rm:5', sentAt: '' });
    expect([...pastePlan(stored, [undated], '2026-10-12').byDate.keys()]).toEqual(['2026-10-12']);
  });
});

describe('dayView with hand-entered patients', () => {
  const manual = patient({ key: 'manual:421:anak', room: '421', dpjpId: 'yp', sentAt: '2026-10-08T08:00', manual: true });
  const floor = { ...FLOOR, manual: { [manual.key]: manual } };

  it('stays on every later list without daily reports, but not on lists before it was entered', () => {
    expect(dayView(floor, [], '2026-10-12').present.map((p) => p.key)).toEqual(['manual:421:anak']);
    expect(dayView(floor, [], '2026-10-07').present).toEqual([]);
  });

  it('a later SOAP for the same RM replaces it', () => {
    const withRm = { ...manual, key: 'rm:77', rm: '77' };
    const soap = patient({ key: 'rm:77', rm: '77', sentAt: '2026-10-12T07:00', body: 'dari SOAP' });
    const view = dayView({ ...FLOOR, manual: { 'rm:77': withRm } }, [day('2026-10-12', [soap])], '2026-10-12');
    expect(view.present.map((p) => [p.key, p.body, p.manual ?? false])).toEqual([['rm:77', 'dari SOAP', false]]);
  });
});

describe('several chiefs (12.11)', () => {
  it('lists them; one chief fills every patient, several leave the choice per patient', () => {
    expect(chiefsOf({ chief: 'Kepala, Ketua ; Kepala' })).toEqual(['Kepala', 'Ketua']);
    const one = { ...emptyDay('2026-10-12'), chief: 'Kepala' };
    const two = { ...emptyDay('2026-10-12'), chief: 'Kepala, Ketua' };
    expect(withEdits(patient({}), FLOOR, one).chief).toBe('Kepala');
    expect(withEdits(patient({}), FLOOR, two).chief).toBe('');
    two.edits['rm:1'] = { chief: 'Ketua' };
    expect(withEdits(patient({}), FLOOR, two).chief).toBe('Ketua');
    expect(withEdits(patient({ key: 'rm:2', chief: 'Dari Pesan' }), FLOOR, two).chief).toBe('Dari Pesan');
  });
});

describe('edited reports (Ubah SOAP, 12.11)', () => {
  it('a re-paste of the same message does not undo the edit; a newer message replaces it', () => {
    const edited = patient({ key: 'rm:1', sentAt: '2026-10-12T07:00', full: 'diubah', edited: true });
    const stored = [day('2026-10-12', [edited])];
    expect(pastePlan(stored, [patient({ key: 'rm:1', sentAt: '2026-10-12T07:00', full: 'asli' })], '2026-10-12').byDate.size).toBe(0);
    expect(pastePlan(stored, [patient({ key: 'rm:1', sentAt: '2026-10-12T09:00', full: 'baru' })], '2026-10-12').updated).toBe(1);
  });
});
