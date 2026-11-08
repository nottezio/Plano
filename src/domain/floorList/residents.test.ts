import { describe, expect, it } from 'vitest';

import type { FloorPatient } from './report';
import { holderBoxes, NO_JUNIOR, residentGroups } from './residents';

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
    ]);
    expect(groups.unassigned.map((x) => x.key)).toEqual(['e']);
    expect(groups.unheld).toEqual([]);
    expect(groups.divisions.map(([n, l]) => [n, l.length])).toEqual([['Divisi Aritmia', 1]]);
  });
});

describe('holderBoxes (19 Oct 2026)', () => {
  it('is named "Tidak di-FU" and comes last, after the division boxes', () => {
    expect(NO_JUNIOR).toBe('Tidak di-FU');
    const boxes = holderBoxes(
      residentGroups([
        p('e', { tags: [{ label: 'Titipan', color: 'grey', noFollowUp: true }] }),
        p('a', { junior: 'Bima' }),
        p('c', { division: 'Aritmia' }),
        p('b', { junior: 'Sari' }),
      ]),
    );
    expect(boxes.map((b) => [b.name, b.list.map((x) => x.key), b.division])).toEqual([
      ['Bima', ['a'], false],
      ['Sari', ['b'], false],
      ['Divisi Aritmia', ['c'], true],
      ['Tidak di-FU', ['e'], false],
    ]);
  });

  it('"Tidak di-FU" holds only tagged patients; no junior yet is its own box (9 Nov 2026)', () => {
    const noFu = [{ label: 'Titipan', color: 'grey' as const, noFollowUp: true as const }];
    const groups = residentGroups([
      p('t', { junior: 'Bima', chief: 'Kirana', tags: noFu }),
      p('a', { junior: 'Bima', chief: 'Kirana' }),
      p('e', { chief: 'Kirana' }),
      p('x', { tags: [{ label: 'Pre-op', color: 'purple' }] }),
    ]);
    expect(groups.chiefs).toEqual([['Kirana', 2]]);
    expect(holderBoxes(groups).map((b) => [b.name, b.list.map((x) => x.key)])).toEqual([
      ['Bima', ['a']],
      ['Belum ada junior', ['e', 'x']],
      ['Tidak di-FU', ['t']],
    ]);
  });

  it('has no "Tidak di-FU" box when everyone is held', () => {
    expect(holderBoxes(residentGroups([p('a', { junior: 'Bima' })])).map((b) => b.name)).toEqual(['Bima']);
  });
});
