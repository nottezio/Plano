import { describe, expect, it } from 'vitest';

import { autoMatches, newMarkId, readMarks } from './marks';

describe('floor marks', () => {
  it('reads only well-formed marks: known colour, a label, a unique id', () => {
    const raw = [
      { id: 'k1', label: ' Pre-op ', color: 'purple' },
      { id: 'k1', label: 'Dobel', color: 'blue' },
      { id: 'k2', label: '', color: 'blue' },
      { id: 'k3', label: 'Ungu?', color: '#ff00ff' },
      'sampah',
    ];
    expect(readMarks(raw)).toEqual([{ id: 'k1', label: 'Pre-op', color: 'purple' }]);
    expect(readMarks(undefined)).toEqual([]);
  });

  it('reads a rule; a DPJP rule without DPJPs is dropped', () => {
    expect(readMarks([{ id: 'k1', label: 'NP', color: 'teal', auto: { kind: 'dpjp', ids: ['np'] } }])[0]!.auto).toEqual({ kind: 'dpjp', ids: ['np'] });
    expect(readMarks([{ id: 'k1', label: 'NP', color: 'teal', auto: { kind: 'dpjp', ids: [] } }])[0]!.auto).toBeUndefined();
    expect(readMarks([{ id: 'k1', label: 'X', color: 'teal', auto: { kind: 'apa' } }])[0]!.auto).toBeUndefined();
  });

  it('rules match their facts', () => {
    const facts = { isNew: false, dpjpId: 'yp', btkv: true, kjs: false, division: false, junior: '' };
    expect(autoMatches({ kind: 'dpjp', ids: ['yp', 'aau'] }, facts)).toBe(true);
    expect(autoMatches({ kind: 'baru' }, facts)).toBe(false);
    expect(autoMatches({ kind: 'btkv' }, facts)).toBe(true);
    expect(autoMatches({ kind: 'tanpa-junior' }, facts)).toBe(true);
    expect(autoMatches({ kind: 'tanpa-junior' }, { ...facts, division: true })).toBe(false);
  });

  it('makes ids that are not taken', () => {
    const marks = readMarks([{ id: 'k2', label: 'Konsul', color: 'teal' }]);
    expect(newMarkId(marks)).toBe('k3');
    expect(newMarkId([{ id: 'k1', label: 'a', color: 'grey' }, { id: 'k2', label: 'b', color: 'grey' }])).toBe('k3');
  });
});
