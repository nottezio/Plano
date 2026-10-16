import { describe, expect, it } from 'vitest';

import { newRosterPatient, type RosterPatient } from './floor';
import {
  editionPoint,
  fromParts,
  isEmptyPlan,
  planRestore,
  pointBeforeRestore,
  restored,
  sameEntry,
  toParts,
  touchedPoint,
  PART_CHARS,
} from './restore';
import type { FloorPatient } from './report';

function report(key: string, over: Partial<FloorPatient> = {}): FloorPatient {
  return {
    key,
    rm: key.slice(3),
    name: `Tn. Contoh ${key}`,
    identity: `Tn. Contoh ${key}`,
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
    senderNick: 'Kirana',
    sender: 'Kirana',
    sentAt: '2026-10-16T07:00',
    index: 0,
    discharge: null,
    ...over,
  };
}

const AT = '2026-10-16T08:00:00.000Z';
const entry = (key: string, over: Partial<FloorPatient> = {}, state: Partial<RosterPatient> = {}): RosterPatient => ({
  ...newRosterPatient(report(key, over), '2026-10-15T00:00:00.000Z', 'Dani'),
  ...state,
});
const meta = { label: 'x', createdAt: AT, createdBy: 'Dani' };

describe('restore points (2026-10-16)', () => {
  it('a Tempel point keeps the patients it will change and the keys it will add; undo reverts those only', () => {
    const before = [entry('rm:1'), entry('rm:2'), entry('rm:3')];
    const point = touchedPoint(before, ['rm:1'], ['rm:9', 'rm:2'], { ...meta, kind: 'tempel' });
    expect(point.patients.map((p) => p.key)).toEqual(['rm:1']);
    // rm:2 already existed: not "added", so undo would never erase it.
    expect(point.added).toEqual(['rm:9']);

    // The paste: rm:1 gets a wrong room, rm:9 is added; a colleague edits rm:3 meanwhile.
    const after = [entry('rm:1', { room: '999' }), entry('rm:2'), entry('rm:3', {}, { junior: 'Bima' }), entry('rm:9')];
    const plan = planRestore(point, after);
    expect(plan.revert.map((r) => [r.patient.key, r.why, r.patient.report.room])).toEqual([['rm:1', 'changed', '417']]);
    expect(plan.remove.map((p) => p.key)).toEqual(['rm:9']);
    expect(plan.same).toBe(0);
    expect(plan.stuck).toEqual([]);
  });

  it('an edition point returns the floor to that list: back, recreated, erased, and named when it cannot', () => {
    const atEdition = [entry('rm:1'), entry('rm:2'), entry('rm:3')];
    const point = editionPoint([...atEdition, entry('rm:8', {}, { status: 'pulang' })], { ...meta, editionId: 'e1' });
    expect(point.patients.map((p) => p.key)).toEqual(['rm:1', 'rm:2', 'rm:3']);

    const now = [
      entry('rm:1'), // unchanged
      entry('rm:2', {}, { status: 'pulang', leftAt: '2026-10-16T09:00:00.000Z' }), // sent home since
      // rm:3 erased by mistake
      entry('rm:7', {}, { addedAt: '2026-10-16T09:30:00.000Z' }), // came in after
      entry('rm:8', {}, { status: 'dirawat' }), // left before, came back after: not in the point
    ];
    const plan = planRestore(point, now);
    expect(plan.revert.map((r) => [r.patient.key, r.why])).toEqual([
      ['rm:2', 'back'],
      ['rm:3', 'recreated'],
    ]);
    expect(plan.remove.map((p) => p.key)).toEqual(['rm:7']);
    expect(plan.stuck.map((p) => p.key)).toEqual(['rm:8']);
    expect(plan.same).toBe(1);
  });

  it('a restore is undoable: the point before it holds what it overwrites and what it recreates', () => {
    const point = editionPoint([entry('rm:1'), entry('rm:3')], { ...meta, editionId: 'e1' });
    const now = [entry('rm:1', { room: '420' }), entry('rm:7', {}, { addedAt: '2026-10-16T09:30:00.000Z' })];
    const plan = planRestore(point, now);
    const undo = pointBeforeRestore(plan, now, meta);
    expect(undo.kind).toBe('pulihkan');
    expect(undo.patients.map((p) => [p.key, p.report.room])).toEqual([
      ['rm:1', '420'],
      ['rm:7', '417'],
    ]);
    expect(undo.added).toEqual(['rm:3']);
    // Applying the restore, then planning the undo against it, gives the "now" back.
    const after = [restored(point.patients[0]!, { at: AT, by: 'Dani', what: 'Dipulihkan' }), point.patients[1]!];
    const back = planRestore(undo, after);
    expect(back.revert.map((r) => r.patient.key)).toEqual(['rm:1', 'rm:7']);
    expect(back.remove.map((p) => p.key)).toEqual(['rm:3']);
  });

  it('ignores the change log when comparing, and an empty plan says so', () => {
    const a = entry('rm:1');
    expect(sameEntry(a, restored(a, { at: AT, by: 'Dani', what: 'x' }))).toBe(true);
    const plan = planRestore(editionPoint([a], { ...meta, editionId: '' }), [a]);
    expect(isEmptyPlan(plan)).toBe(true);
  });

  it('round-trips through parts, split when long', () => {
    const big = Array.from({ length: 120 }, (_, i) => entry(`rm:${i}`, { full: 'x'.repeat(4000) }));
    const parts = toParts({ patients: big, added: ['rm:999'] });
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= PART_CHARS)).toBe(true);
    const back = fromParts(parts, (key, data) => ({ ...(data as unknown as RosterPatient), key }));
    expect(back.patients).toHaveLength(120);
    expect(back.patients[5]!.report.full).toHaveLength(4000);
    expect(back.added).toEqual(['rm:999']);
    expect(fromParts(['{broken'], () => null)).toEqual({ patients: [], added: [] });
  });
});
