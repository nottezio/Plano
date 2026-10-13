import { describe, expect, it } from 'vitest';

import { markOf, newMarkId, readMarks } from './marks';

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

  it('finds the mark a colour names, and makes ids that are not taken', () => {
    const marks = readMarks([{ id: 'k2', label: 'Konsul', color: 'teal' }]);
    expect(markOf('m:k2', marks)?.label).toBe('Konsul');
    expect(markOf('h1', marks)).toBeNull();
    expect(markOf('m:k5', marks)).toBeNull();
    expect(newMarkId(marks)).toBe('k3');
    expect(newMarkId([{ id: 'k1', label: 'a', color: 'grey' }, { id: 'k2', label: 'b', color: 'grey' }])).toBe('k3');
  });
});
