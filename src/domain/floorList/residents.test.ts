import { describe, expect, it } from 'vitest';

import type { FloorPatient } from './report';
import { residentGroups } from './residents';

const p = (key: string, over: Partial<FloorPatient>): FloorPatient => ({ key, junior: '', chief: '', ...over }) as FloorPatient;

describe('residentGroups', () => {
  it('juniors in order, chiefs counted; a division patient in its own block, counted for nobody', () => {
    const groups = residentGroups([
      p('a', { junior: 'Bima', chief: 'Kirana' }),
      p('b', { junior: 'Sari', chief: 'Kirana' }),
      p('c', { division: 'Aritmia' }),
      p('d', { junior: 'Bima', chief: 'Kirana' }),
      p('e', {}),
    ]);
    expect(groups.chiefs).toEqual([['Kirana', 3]]);
    expect(groups.juniors.map(([n, l]) => [n, l.map((x) => x.key)])).toEqual([
      ['Bima', ['a', 'd']],
      ['Sari', ['b']],
      ['(belum diisi)', ['e']],
    ]);
    expect(groups.divisions.map(([n, l]) => [n, l.length])).toEqual([['Divisi Aritmia', 1]]);
  });
});
