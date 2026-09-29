import { describe, expect, it } from 'vitest';

import { mergeProfile, parseBundle, planImport } from './importBundle';

const bundle = {
  exportedAt: '2026-09-29T10:00:00.000Z',
  appVersion: 'versi-lama',
  schemaVersion: 1,
  profile: { settings: { a: 1 }, notesById: { n1: { body: 'x' } }, uid: 'old' },
  patients: [
    {
      id: 'p-old-1',
      ownerId: 'old',
      memberIds: ['old'],
      name: 'Tn. Contoh',
      status: 'active',
      entries: [{ date: '2026-09-28', body: 'S: -', baseHash: 'h', editing: { by: 'x' } }],
      checklists: [{ date: '2026-09-28', items: {} }],
    },
    { id: 'p-here', name: 'Sudah ada', entries: [], checklists: [] },
  ],
  documents: [{ id: 'd1', title: 'A' }, { id: 'd-here', title: 'B' }],
};

describe('parseBundle', () => {
  it('refuses what is not a Plano export, or is from a newer schema', () => {
    expect(parseBundle('nope').ok).toBe(false);
    expect(parseBundle('{"x":1}').ok).toBe(false);
    expect(parseBundle(JSON.stringify({ ...bundle, schemaVersion: 99 })).ok).toBe(false);
    expect(parseBundle(JSON.stringify(bundle)).ok).toBe(true);
  });
});

describe('planImport', () => {
  const plan = planImport(bundle, [{ id: 'p-here' }], new Set(['d-here']), 'me', () => 'NEW');

  it('gives imported patients a new id, this account as owner, and remembers the old id', () => {
    expect(plan.patients).toHaveLength(1);
    const [patient] = plan.patients;
    expect(patient?.record).toMatchObject({ id: 'NEW', ownerId: 'me', memberIds: ['me'], importedFrom: 'p-old-1', deletedAt: null });
    expect(patient?.record).not.toHaveProperty('entries');
  });

  it('never overwrites: patients and documents already here are skipped', () => {
    expect(plan.skippedPatients).toEqual(['Sudah ada']);
    expect(plan.documents.map((document) => document['id'])).toEqual(['d1']);
    expect(plan.skippedDocuments).toBe(1);
  });

  it('drops per-request fields from entries', () => {
    const entry = plan.patients[0]?.entries[0]?.data;
    expect(entry).not.toHaveProperty('baseHash');
    expect(entry?.['editing']).toBeNull();
  });

  it('is idempotent: a second import of the same file adds nothing', () => {
    const again = planImport(bundle, [{ id: 'p-here' }, { id: 'NEW', importedFrom: 'p-old-1' }], new Set(['d1', 'd-here']), 'me', () => 'X');
    expect(again.patients).toHaveLength(0);
    expect(again.documents).toHaveLength(0);
  });

  it('carries only the person’s own profile fields', () => {
    expect(Object.keys(plan.profile).sort()).toEqual(['notesById', 'settings']);
  });
});

describe('mergeProfile', () => {
  it('adds missing notes, keeps existing ones, replaces settings only when asked', () => {
    const current = { notesById: { n1: { body: 'mine' } }, settings: { a: 0 } };
    const incoming = { notesById: { n1: { body: 'theirs' }, n2: { body: 'new' } }, settings: { a: 1 } };
    const patch = mergeProfile(current, incoming, false);
    expect(patch['notesById']).toEqual({ n1: { body: 'mine' }, n2: { body: 'new' } });
    expect(patch).not.toHaveProperty('settings');
    expect(mergeProfile(current, incoming, true)['settings']).toEqual({ a: 1 });
  });
});
