import { describe, expect, it } from 'vitest';

import { UNPLACED, buildDenah, denahLine } from './denah';
import { makePatient } from './testFactories';
import type { Patient } from './types';

const at = (id: string, ward: string, room?: string, bed?: string): Patient => ({
  ...makePatient({ id, ward }),
  ...(room ? { room } : {}),
  ...(bed ? { bed } : {}),
});

describe('buildDenah', () => {
  it('orders rooms numerically, like the ward is numbered', () => {
    const denah = buildDenah([
      at('c', 'PJT Lt 4', '421'),
      at('a', 'PJT Lt 4', '401'),
      at('b', 'PJT Lt 4', '410'),
    ]);
    expect(denah[0]?.rooms.map((room) => room.room)).toEqual(['401', '410', '421']);
  });

  it('orders beds numerically within a room', () => {
    const denah = buildDenah([
      at('b6', 'PJT Lt 4', '420', '6'),
      at('b2', 'PJT Lt 4', '420', '2'),
      at('b10', 'PJT Lt 4', '420', '10'),
    ]);
    expect(denah[0]?.rooms[0]?.beds.map((bed) => bed.bed)).toEqual(['2', '6', '10']);
  });

  it('separates wards', () => {
    const denah = buildDenah([at('a', 'PJT Lt 4', '401'), at('b', 'PJT Lt 5', '517')]);
    expect(denah.map((ward) => ward.ward)).toEqual(['PJT Lt 4', 'PJT Lt 5']);
  });

  it('puts non-numeric rooms after the numbered ones', () => {
    const denah = buildDenah([at('v', 'PJT Lt 4', 'VIP'), at('n', 'PJT Lt 4', '419')]);
    expect(denah[0]?.rooms.map((room) => room.room)).toEqual(['419', 'VIP']);
  });

  it('keeps a patient with a ward but no room visible in that ward', () => {
    const denah = buildDenah([at('x', 'PJT Lt 4')]);
    expect(denah[0]?.ward).toBe('PJT Lt 4');
    expect(denah[0]?.rooms[0]?.beds).toHaveLength(1);
  });

  it('collects patients with no location at the end', () => {
    const denah = buildDenah([makePatient({ id: 'blank' }), at('a', 'PJT Lt 4', '401')]);
    expect(denah[denah.length - 1]?.ward).toBe(UNPLACED);
  });

  it('loses nobody', () => {
    const patients = [
      at('a', 'PJT Lt 4', '401', '1'),
      at('b', 'PJT Lt 4', '401', '2'),
      at('c', 'PJT Lt 5', '517'),
      makePatient({ id: 'd' }),
    ];
    const total = buildDenah(patients)
      .flatMap((ward) => ward.rooms)
      .flatMap((room) => room.beds).length;
    expect(total).toBe(patients.length);
  });

  it('is empty for no patients', () => {
    expect(buildDenah([])).toEqual([]);
  });
});

describe('denahLine', () => {
  it('reads like the denah does', () => {
    const patient: Patient = {
      ...makePatient({ name: 'Tn. Roni Sampebua', age: 66 }),
      mrn: '1691002',
      dpjpId: 'afm',
    };
    expect(denahLine(patient, false)).toBe('AFM / Tn. Roni Sampebua / 66 th / RM 1691002');
  });

  it('honours initials-only mode', () => {
    const patient = { ...makePatient({ name: 'Tn. Roni Sampebua' }), dpjpId: 'afm' };
    const line = denahLine(patient, true);
    expect(line).toContain('R.S');
    expect(line).not.toContain('Roni');
  });

  it('omits what is not known rather than printing gaps', () => {
    expect(denahLine(makePatient({ name: 'Tn. Budi' }), false)).toBe('Tn. Budi');
  });

  it('names an unnamed patient rather than showing nothing', () => {
    expect(denahLine(makePatient({ name: '' }), false)).toBe('Tanpa nama');
  });
});
