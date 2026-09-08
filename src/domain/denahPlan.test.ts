import { describe, expect, it } from 'vitest';

import { placeInPlan } from './denah';
import { planRooms, wardPlan } from './denahPlan';
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
    expect(wardPlan('PJT Lantai 5')).toBeNull();
    expect(wardPlan('CVCU')).toBeNull();
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
    for (const ward of ['PJT Lt. 5', 'PJT Lantai 5', 'CVCU']) {
      expect(wardPlan(ward)).toBeNull();
    }
  });
});
