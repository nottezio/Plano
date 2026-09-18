import { describe, expect, it } from 'vitest';

import { planLateWrite } from './lateWrite';

const BASE = ['S: nyeri dada', 'O: TD 120/80', 'A: CAD', 'P: Aspilet 80 mg'].join('\n');

describe('planLateWrite', () => {
  it('drops a write the server already has', () => {
    expect(planLateWrite({ body: BASE, base: BASE, server: BASE })).toEqual({ kind: 'landed' });
  });

  it('rewrites when the server never moved (the write was lost or refused)', () => {
    const mine = BASE.replace('Aspilet 80 mg', 'Aspilet 80 mg\nP: CPG 75 mg');
    expect(planLateWrite({ body: mine, base: BASE, server: BASE })).toEqual({
      kind: 'rewrite',
      body: mine,
      base: BASE,
    });
  });

  it('merges disjoint changes and writes against what the server holds now', () => {
    // Phone edited the plan offline; the PC edited the subjective line since.
    const mine = BASE.replace('P: Aspilet 80 mg', 'P: Aspilet 80 mg, CPG 75 mg');
    const server = BASE.replace('S: nyeri dada', 'S: nyeri dada berkurang');
    const plan = planLateWrite({ body: mine, base: BASE, server });
    expect(plan.kind).toBe('merge');
    if (plan.kind !== 'merge') return;
    expect(plan.body).toContain('CPG 75 mg');
    expect(plan.body).toContain('nyeri dada berkurang');
    expect(plan.base).toBe(server);
    expect(plan.replaced).toBe(server);
  });

  it('asks for review when both changed the same line, and keeps the offline text', () => {
    const mine = BASE.replace('P: Aspilet 80 mg', 'P: Aspilet 160 mg');
    const server = BASE.replace('P: Aspilet 80 mg', 'P: Aspilet 80 mg + CPG');
    const plan = planLateWrite({ body: mine, base: BASE, server });
    expect(plan).toEqual({ kind: 'review', body: mine, server });
  });

  it('drops a write whose change the server already contains', () => {
    const newer = BASE.replace('A: CAD', 'A: CAD 2VD');
    // This device changed nothing, the server moved on.
    expect(planLateWrite({ body: BASE, base: BASE, server: newer })).toEqual({ kind: 'landed' });
  });

  it('never silently discards an offline edit when there is no usable base', () => {
    const plan = planLateWrite({ body: 'catatan luring', base: '', server: 'catatan lain' });
    expect(plan.kind).toBe('review');
  });
});

describe('the same-line guard, which is what keeps a dose safe', () => {
  const plan = (mine: string, server: string) => planLateWrite({ body: mine, base: BASE, server });

  it('refuses to combine two edits of one drug line, even though the merge engine would', () => {
    expect(plan(BASE.replace('80 mg', '160 mg'), BASE.replace('80 mg', '80 mg + CPG')).kind).toBe(
      'review',
    );
  });

  it('still merges edits to different lines', () => {
    expect(plan(BASE.replace('A: CAD', 'A: CAD 2VD'), BASE.replace('O: TD 120/80', 'O: TD 130/80')).kind).toBe(
      'merge',
    );
  });

  it('asks about two drugs appended at the same spot rather than ordering them itself', () => {
    // Both sides added a line at the end of the plan. Keeping both in some
    // order would be a guess about someone's therapy list, so it is asked.
    expect(plan(`${BASE}\nP: CPG 75 mg`, `${BASE}\nP: Bisoprolol 2.5 mg`).kind).toBe('review');
  });

  it('ignores blank-line differences when deciding overlap', () => {
    const spaced = BASE.split('\n').join('\n\n');
    expect(plan(`${spaced}\nP: CPG 75 mg`, BASE.replace('O: TD 120/80', 'O: TD 130/80')).kind).toBe(
      'merge',
    );
  });
});
