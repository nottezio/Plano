import { describe, expect, it } from 'vitest';

import { buildCards } from './board';
import { DEFAULT_CHECKLIST } from './defaults';
import { makePatient } from './testFactories';
import { reuseUnchanged } from '@/data/repositories/patients.repo';
import type { Patient } from './types';

const TODAY = '2026-11-10';

describe('reuseUnchanged', () => {
  const a = makePatient({ id: 'a', name: 'Tn. A' });
  const b = makePatient({ id: 'b', name: 'Tn. B' });
  const doc = (patient: Patient) => ({ id: patient.id, data: () => ({ ...patient }) });

  it('keeps the previous object for a doc the snapshot did not change', () => {
    const previous = new Map([[a.id, a], [b.id, b]]);
    const next = reuseUnchanged([doc(a), doc(b)], new Set(['b']), previous);
    expect(next[0]).toBe(a);
    expect(next[1]).not.toBe(b);
    expect(next[1]).toEqual(b);
  });

  it('builds new objects on a first snapshot', () => {
    const next = reuseUnchanged([doc(a)], new Set(), new Map());
    expect(next[0]).not.toBe(a);
    expect(next[0]).toEqual(a);
  });
});

describe('buildCards', () => {
  const a = makePatient({ id: 'a', name: 'Tn. A' });
  const b = makePatient({ id: 'b', name: 'Tn. B' });

  it('rebuilds only the card whose patient object changed', () => {
    const first = buildCards(null, [a, b], DEFAULT_CHECKLIST, TODAY, false);
    const b2 = { ...b, name: 'Tn. B2' };
    const second = buildCards(first.cache, [a, b2], DEFAULT_CHECKLIST, TODAY, false);
    expect(second.cards[0]).toBe(first.cards[0]);
    expect(second.cards[1]).not.toBe(first.cards[1]);
    expect(second.cards[1]?.name).toContain('B2');
  });

  it('rebuilds every card when another input changes', () => {
    const first = buildCards(null, [a], DEFAULT_CHECKLIST, TODAY, false);
    const nextDay = buildCards(first.cache, [a], DEFAULT_CHECKLIST, '2026-11-11', false);
    const initials = buildCards(first.cache, [a], DEFAULT_CHECKLIST, TODAY, true);
    expect(nextDay.cards[0]).not.toBe(first.cards[0]);
    expect(initials.cards[0]).not.toBe(first.cards[0]);
  });
});
