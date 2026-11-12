import { describe, expect, it } from 'vitest';

import { placeInPlan } from './denah';
import { inAnnex, planRooms, planWards, visitIndex, wardFloors, wardLabel, wardPlan } from './denahPlan';
import { planLayout } from './floorList/layout';
import type { Patient } from './types';

const patient = (over: Partial<Patient>): Patient =>
  ({ id: over.room ?? 'x', name: 'Tn. X', labels: [], diagnoses: [], ...over }) as Patient;

describe('wardPlan', () => {
  it('knows PJT Lantai 4, whatever the spacing or case', () => {
    expect(wardPlan('PJT Lantai 4')?.ward).toBe('PJT Lantai 4');
    expect(wardPlan('  pjt   lantai 4 ')?.ward).toBe('PJT Lantai 4');
  });

  it('returns null for a ward with no transcribed sheet', () => {
    // The ordinary case, not a failure: a ward is only laid out against the
    // wall once somebody has checked it against the wall.
    expect(wardPlan('PJT Lantai 6')).toBeNull();
    expect(wardPlan('CVCU')).toBeNull();
  });

  it('knows PJT Lantai 5, room for room, with the sheet bed counts', () => {
    const rooms = planRooms(wardPlan('PJT Lt. 5')!);
    expect(rooms.map((room) => room.room).sort()).toEqual(
      [
        '501', '502', '503', '504', '505', '506', '507', '508A', '508B', '509',
        '510', '511', '512', '513', '514', '515', '516', '517', '518', '519',
      ].sort(),
    );
    const beds = new Map(rooms.map((r) => [r.room, r.beds]));
    expect(beds.get('510')).toBe(6);
    expect(beds.get('513')).toBe(2);
    expect(beds.get('518')).toBe(4);
    expect(beds.get('501')).toBe(1);
  });

  it('matches the printed sheet, room for room', () => {
    const rooms = planRooms(wardPlan('PJT Lantai 4')!);
    expect(rooms.map((room) => room.room).sort()).toEqual(
      [
        '401', '402', '403', '404', '405', '406', '407', '408', '409', '410',
        '411', '412', '413', '414', '415', '416', '417', '418', '419', '420',
        '421',
      ].sort(),
    );
  });

  it('carries the bed counts the sheet numbers', () => {
    const beds = new Map(planRooms(wardPlan('PJT Lantai 4')!).map((r) => [r.room, r.beds]));
    expect(beds.get('420')).toBe(6);
    expect(beds.get('421')).toBe(6);
    expect(beds.get('419')).toBe(4);
    expect(beds.get('413')).toBe(2);
    expect(beds.get('410')).toBe(1);
  });
});

describe('planWards', () => {
  it('lists every ward with a plan, for the new-list choice', () => {
    expect(planWards()).toEqual(['PJT Lantai 4', 'PJT Lantai 5']);
  });
});

describe('PJT Lantai 5 layout', () => {
  const plan = wardPlan('PJT Lt. 5')!;
  const layout = planLayout(plan);

  it('puts 508 B and 508 A side by side, so both sides have eight rows', () => {
    expect(layout.rows).toBe(8);
    expect(layout.left).toHaveLength(8);
    expect(layout.right).toHaveLength(8);
    expect(layout.left[1]?.slots.map((s) => s.room)).toEqual(['508B', '508A']);
  });

  it('gives the centre a nurse station row, the Lantai 6 box, then 501 at the bottom', () => {
    expect(layout.landmark).toMatchObject({ row: 0, span: 1 });
    expect(layout.annex).toMatchObject({ label: 'LANTAI 6', row: 1, span: 6 });
    expect(layout.centre[0]).toMatchObject({ row: 7, span: 1 });
    expect(layout.centre[0]?.slots[0]?.room).toBe('501');
  });

  it('keeps Lantai 6 rooms out of "Di luar denah"', () => {
    expect(inAnnex(plan, '604')).toBe(true);
    expect(inAnnex(plan, '505')).toBe(false);
    expect(inAnnex(wardPlan('PJT Lantai 4')!, '604')).toBe(false);
  });

  it('visits clockwise from 510 to 509, with 501 between 519 and 502', () => {
    const at = (room: string): number => visitIndex('PJT Lt. 5', room)!;
    expect(at('510')).toBe(0);
    expect(at('511')).toBe(1);
    expect(at('519')).toBeLessThan(at('501'));
    expect(at('501')).toBeLessThan(at('502'));
    expect(at('508A')).toBeLessThan(at('508B'));
    expect(at('509')).toBe(19);
  });
});

describe('placeInPlan', () => {
  const rooms = planRooms(wardPlan('PJT Lantai 4')!);

  it('puts a patient in the bed the record names, not the next free one', () => {
    // Matching by array order would send someone to the wrong bed.
    const { rooms: placed } = placeInPlan([patient({ id: 'a', room: '419', bed: '2' })], rooms);
    const room = placed.find((r) => r.room === '419')!;
    expect(room.beds[0]).toBeNull();
    expect(room.beds[1]?.id).toBe('a');
  });

  it('draws empty beds as empty', () => {
    const { rooms: placed } = placeInPlan([], rooms);
    expect(placed.find((r) => r.room === '419')?.beds).toEqual([null, null, null, null]);
  });

  it('surfaces a patient with no bed recorded rather than dropping them', () => {
    const { rooms: placed } = placeInPlan([patient({ id: 'a', room: '415' })], rooms);
    expect(placed.find((r) => r.room === '415')?.extra.map((p) => p.id)).toEqual(['a']);
  });

  it('surfaces a bed number the sheet does not have', () => {
    const { rooms: placed } = placeInPlan([patient({ id: 'a', room: '415', bed: '7' })], rooms);
    expect(placed.find((r) => r.room === '415')?.extra.map((p) => p.id)).toEqual(['a']);
  });

  it('does not discard the second patient recorded in one bed', () => {
    // Two in one bed is a data problem to surface, not one to resolve by
    // losing a patient.
    const { rooms: placed } = placeInPlan(
      [patient({ id: 'a', room: '415', bed: '1' }), patient({ id: 'b', room: '415', bed: '1' })],
      rooms,
    );
    const room = placed.find((r) => r.room === '415')!;
    expect(room.beds[0]?.id).toBe('a');
    expect(room.extra.map((p) => p.id)).toEqual(['b']);
  });

  it('reports a room the sheet does not list', () => {
    const { strays } = placeInPlan([patient({ id: 'a', room: '499', bed: '1' })], rooms);
    expect(strays.map((p) => p.id)).toEqual(['a']);
  });
});

describe('ward names as recorded, not as printed', () => {
  it('matches every spelling of the floor that the records use', () => {
    /*
     * The sheet says "PJT LANTAI 4"; the patient records say "PJT Lt. 4".
     * Matching the printed spelling meant the plan never resolved for a single
     * real patient — which looks like the feature was never built.
     */
    for (const ward of ['PJT Lantai 4', 'PJT Lt. 4', 'PJT Lt 4', 'PJT LT. 4', 'pjt lt.4']) {
      expect(wardPlan(ward)?.ward).toBe('PJT Lantai 4');
    }
  });

  it('still does not match a different floor', () => {
    for (const ward of ['PJT Lt. 6', 'PJT Lantai 6', 'CVCU']) {
      expect(wardPlan(ward)).toBeNull();
    }
  });
});

describe('Lantai 5 dan 6', () => {
  it('goes by "PJT Lantai 5 dan 6" for people, but still matches as Lantai 5', () => {
    expect(wardLabel('PJT Lt. 5')).toBe('PJT Lantai 5 dan 6');
    expect(wardPlan('PJT Lt. 5')?.ward).toBe('PJT Lantai 5');
    expect(wardLabel('PJT Lantai 4')).toBe('PJT Lantai 4');
    expect(wardLabel('CVCU')).toBe('CVCU');
  });

  it('files reports of both floors in the Lantai 5 list, only its own in Lantai 4', () => {
    expect(wardFloors('PJT Lantai 5')).toEqual(['5', '6']);
    expect(wardFloors('PJT Lantai 4')).toEqual(['4']);
    expect(wardFloors('CVCU')).toEqual(['']);
  });
});
