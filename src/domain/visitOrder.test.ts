import { describe, expect, it } from 'vitest';

import { groupLabel, orderPatients } from './board';
import { visitIndex } from './denahPlan';
import { makePatient } from './testFactories';

const at = (id: string, room: string, bed: string, ward = 'PJT Lantai 4') =>
  makePatient({ id, ward, room, bed } as never);

describe('Urutan visite', () => {
  it('walks the PJT Lantai 4 loop: 420 → 421 → 412…419 → 411 → 401…410, beds ascending', () => {
    const patients = [
      at('a', '410', '1'),
      at('b', '401', '1'),
      at('c', '411', '1'),
      at('d', '419', '2'),
      at('e', '412', '1'),
      at('f', '421', '3'),
      at('g', '420', '5'),
      at('h', '420', '2'),
      at('i', '417', '1'),
    ];
    const order = orderPatients(patients, 'visite').map((patient) => patient.id);
    expect(order).toEqual(['h', 'g', 'f', 'e', 'i', 'd', 'c', 'b', 'a']);
  });

  it('matches the ward however it is written', () => {
    expect(visitIndex('PJT Lt. 4', '420')).toBe(0);
    expect(visitIndex('pjt lantai 4', '410')).toBe(20);
    expect(visitIndex('PJT Lantai 4', '499')).toBeNull();
    expect(visitIndex('ICVCU', '1')).toBeNull();
  });

  it('rooms off the route, then patients without a location, come last', () => {
    const patients = [
      makePatient({ id: 'none' } as never),
      at('off', '430', '1'),
      at('first', '420', '1'),
    ];
    expect(orderPatients(patients, 'visite').map((patient) => patient.id)).toEqual(['first', 'off', 'none']);
  });

  it('groups by ward', () => {
    expect(groupLabel(at('x', '420', '1', 'PJT Lt. 4'), 'visite')).toBe('PJT Lantai 4');
  });
});
