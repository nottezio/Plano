import { describe, expect, it } from 'vitest';

import { assignGroup, loadsWith, needsHolder, proposeAssignment } from './assign';
import type { FloorPatient } from './report';

const p = (key: string, dpjpId: string | null, junior = '', extra: Partial<FloorPatient> = {}): FloorPatient =>
  ({ key, dpjpId, kjsDpjpIds: [], junior, ...extra }) as FloorPatient;

const RES = ['Ana', 'Budi', 'Cici'];

describe('Bagi pasien (10 Nov 2026)', () => {
  it('gives out only followed-up patients a floor resident does not hold', () => {
    expect(needsHolder(p('1', 'ks'), RES)).toBe(true);
    expect(needsHolder(p('2', 'ks', 'Malam'), RES)).toBe(true); // tonight's resident, not on the floor tomorrow
    expect(needsHolder(p('3', 'ks', 'ana'), RES)).toBe(false); // kept: a floor resident follows it
    expect(needsHolder(p('4', 'ks', '', { division: 'Aritmia' }), RES)).toBe(false);
    expect(needsHolder(p('5', 'ks', '', { tags: [{ label: 'Titipan', color: 'grey', noFollowUp: true }] }), RES)).toBe(false);
  });

  it('MZ (utama or KJS) first, then Trio, then the rest', () => {
    expect(assignGroup({ dpjpId: 'mz', kjsDpjpIds: [] })).toBe('mz');
    expect(assignGroup({ dpjpId: 'zd', kjsDpjpIds: ['mz'] })).toBe('mz');
    expect(assignGroup({ dpjpId: 'afg', kjsDpjpIds: [] })).toBe('trio');
    expect(assignGroup({ dpjpId: 'ks', kjsDpjpIds: [] })).toBe('lain');
  });

  it('MZ goes one each before anyone gets a second, counting the ones already held', () => {
    const patients = [p('k1', 'mz', 'Ana'), p('n1', 'mz'), p('n2', 'mz'), p('n3', 'mz')];
    const out = proposeAssignment(patients, RES);
    expect([out.get('n1'), out.get('n2')].sort()).toEqual(['Budi', 'Cici']);
    expect(out.has('k1')).toBe(false);
    const mz = loadsWith(patients, RES, out).map((l) => l.after.mz);
    expect(Math.max(...mz) - Math.min(...mz)).toBeLessThanOrEqual(1);
  });

  it('Trio stays even, and the rest go to the lightest total load', () => {
    const patients = [p('k1', 'ks', 'Ana'), p('k2', 'ks', 'Ana'), p('t1', 'afm'), p('t2', 'zd'), p('t3', 'afg'), p('o1', 'ks'), p('o2', 'pt')];
    const out = proposeAssignment(patients, RES);
    const after = loadsWith(patients, RES, out);
    expect(after.map((l) => l.after.trio)).toEqual([1, 1, 1]);
    // Ana held 2 already: the two others go to Budi and Cici.
    expect([out.get('o1'), out.get('o2')].sort()).toEqual(['Budi', 'Cici']);
    expect(after.map((l) => l.after.total)).toEqual([3, 2, 2]);
  });

  it('the same list gives the same answer; no floor residents, no proposal', () => {
    const patients = [p('a', 'mz'), p('b', 'afm'), p('c', 'ks')];
    expect([...proposeAssignment(patients, RES)]).toEqual([...proposeAssignment(patients, RES)]);
    expect(proposeAssignment(patients, []).size).toBe(0);
  });

  it('a resident left out (the list maker) gets none, and keeps their own patients (11 Nov 2026)', () => {
    const patients = [p('k1', 'ks', 'Ana'), p('n1', 'mz'), p('n2', 'afm'), p('n3', 'ks')];
    const out = proposeAssignment(patients, RES, new Set(['Ana']));
    expect(out.has('k1')).toBe(false);
    expect([...out.values()].every((r) => r !== 'Ana')).toBe(true);
    expect(out.size).toBe(3);
    expect(proposeAssignment(patients, RES, new Set(RES)).size).toBe(0);
  });

  it('before/after follow a choice changed by hand', () => {
    const patients = [p('a', 'mz'), p('b', 'ks', 'Budi')];
    const loads = loadsWith(patients, RES, new Map([['a', 'Budi']]));
    expect(loads.find((l) => l.name === 'Budi')).toEqual({ name: 'Budi', before: { total: 1, mz: 0, trio: 0 }, after: { total: 2, mz: 1, trio: 0 } });
  });
});
