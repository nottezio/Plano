import { describe, expect, it } from 'vitest';

import { defaultUserSettings, SEED_SNAPSHOT } from './defaults';
import {
  mergeStringList,
  outdatedTemplates,
  reconcileSeeds,
  resetTemplateToSeed,
  snapshotOf,
} from './seedSync';
import type { SeedSnapshot } from './seedSync';
import type { UserSettings } from './types';

const seeds = (over: Partial<SeedSnapshot> = {}): SeedSnapshot => ({
  noteTemplates: [{ id: 'followup', name: 'Follow-up', body: 'A\nB\nC', order: 1 }],
  greetings: ['Selamat pagi dokter.'],
  openingSentences: ['Mohon izin melaporkan'],
  closingSentences: ['Terima kasih dokter'],
  carryForwardClearSections: ['s'],
  ...over,
});

const settingsFrom = (base: SeedSnapshot, over: Partial<UserSettings> = {}): UserSettings => ({
  ...defaultUserSettings(),
  noteTemplates: base.noteTemplates.map((t) => ({ ...t })),
  greetings: [...base.greetings],
  openingSentences: [...base.openingSentences],
  closingSentences: [...base.closingSentences],
  seedBaseline: snapshotOf(base),
  ...over,
});

describe('mergeStringList', () => {
  it('brings a new seeded phrase through', () => {
    const { next } = mergeStringList(['a'], ['a'], ['a', 'b']);
    expect(next).toEqual(['a', 'b']);
  });

  it('replaces a corrected phrase instead of leaving both', () => {
    // A correction arrives as (retired, added). Keeping both would leave the
    // user picking from a menu that still contains the mistake.
    const { next } = mergeStringList(['Selamat pagi dokter'], ['Selamat pagi dokter'], [
      'Selamat pagi dokter.',
    ]);
    expect(next).toEqual(['Selamat pagi dokter.']);
  });

  it('keeps the user own phrases', () => {
    const { next } = mergeStringList(['a'], ['a', 'mine'], ['a', 'b']);
    expect(next).toEqual(['a', 'mine', 'b']);
  });

  it('does not resurrect a phrase the user deleted', () => {
    // Present in baseline AND seed, absent locally: a deliberate deletion.
    // Restoring it on every load would make deletion impossible.
    const { next } = mergeStringList(['a', 'b'], ['a'], ['a', 'b']);
    expect(next).toEqual(['a']);
  });

  it('treats a reorder as a reorder, not an edit', () => {
    const { next, changed } = mergeStringList(['a', 'b'], ['b', 'a'], ['a', 'b']);
    expect(next).toEqual(['b', 'a']);
    expect(changed).toBe(0);
  });
});

describe('reconcileSeeds', () => {
  it('records a baseline and changes nothing on first run', () => {
    /*
     * With no ancestor there is no way to tell an edited template from a stale
     * one. Overwriting would destroy real work on the one run where we know
     * the least, so the first run only learns.
     */
    const base = seeds();
    const local = settingsFrom(base);
    delete local.seedBaseline;
    local.noteTemplates[0]!.body = 'my own wording';

    const result = reconcileSeeds(local, base);
    expect(result.settings.noteTemplates[0]!.body).toBe('my own wording');
    expect(result.settings.seedBaseline).toEqual(snapshotOf(base));
    expect(result.dirty).toBe(true);
  });

  it('is a no-op once the baseline matches', () => {
    const base = seeds();
    const result = reconcileSeeds(settingsFrom(base), base);
    expect(result.dirty).toBe(false);
  });

  it('fast-forwards a template the user never touched', () => {
    const base = seeds();
    const next = seeds({
      noteTemplates: [{ id: 'followup', name: 'Follow-up', body: 'A\nB2\nC', order: 1 }],
    });
    const result = reconcileSeeds(settingsFrom(base), next);
    expect(result.settings.noteTemplates[0]!.body).toBe('A\nB2\nC');
    expect(result.report.updated).toEqual(['Follow-up']);
  });

  it('keeps the user edit AND takes the seed fix in the same template', () => {
    // The whole point. Previously these were mutually exclusive: take the fix
    // by deleting your copy, or keep your wording and keep the bug.
    /*
     * A realistic body, not a three-line stub. `mergeThreeWay` is tuned
     * strictly on purpose (match threshold 0.35) so it asks rather than
     * guesses, and on a stub there is not enough unique context for any hunk
     * to land — it would report a conflict and prove nothing.
     */
    const seedBody = [
      '*S:*',
      '- Keluhan nyeri dada tidak ada, sesak napas tidak ada.',
      '',
      '*O:*',
      'Tekanan Darah :  mmHg',
      'Nadi :  kali/menit, reguler',
      '',
      '*Mohon izin kami assess dengan:*',
      '- ',
      '',
      '*Plan:*',
      '- Monitoring tanda vital dan hemodinamik',
    ].join('\n');

    const base = seeds({
      noteTemplates: [{ id: 'followup', name: 'Follow-up', body: seedBody, order: 1 }],
    });
    const local = settingsFrom(base);
    local.noteTemplates[0]!.body = seedBody.replace(
      '- Monitoring tanda vital dan hemodinamik',
      '- Monitoring tanda vital dan hemodinamik\n- EKG per hari (tambahan saya)',
    );

    const next = seeds({
      noteTemplates: [
        {
          id: 'followup',
          name: 'Follow-up',
          body: seedBody.replace('Nadi :  kali/menit, reguler', 'Nadi :  kali/menit, reguler\nPernapasan :  kali/menit'),
          order: 1,
        },
      ],
    });

    const result = reconcileSeeds(local, next);
    const body = result.settings.noteTemplates[0]!.body;
    expect(body).toContain('- EKG per hari (tambahan saya)');
    expect(body).toContain('Pernapasan :  kali/menit');
    expect(result.report.conflicted).toEqual([]);
  });

  it('does not restore a seeded template the user deleted', () => {
    const base = seeds();
    const local = settingsFrom(base, { noteTemplates: [] });
    const result = reconcileSeeds(local, base);
    expect(result.settings.noteTemplates).toEqual([]);
  });

  it('adds a genuinely new seeded template', () => {
    const base = seeds();
    const next = seeds({
      noteTemplates: [
        ...base.noteTemplates,
        { id: 'jaga', name: 'SOAP Jaga', body: 'X', order: 2 },
      ],
    });
    const result = reconcileSeeds(settingsFrom(base), next);
    expect(result.settings.noteTemplates.map((t) => t.id)).toEqual(['followup', 'jaga']);
  });

  it('leaves the user own templates entirely alone', () => {
    const base = seeds();
    const local = settingsFrom(base);
    local.noteTemplates.push({ id: 'mine', name: 'Punyaku', body: 'Z', order: 9 });
    const next = seeds({
      noteTemplates: [{ id: 'followup', name: 'Follow-up', body: 'A\nB2\nC', order: 1 }],
    });
    const result = reconcileSeeds(local, next);
    expect(result.settings.noteTemplates.find((t) => t.id === 'mine')?.body).toBe('Z');
  });

  it('keeps a rename', () => {
    const base = seeds();
    const local = settingsFrom(base);
    local.noteTemplates[0]!.name = 'Namaku sendiri';
    const next = seeds({
      noteTemplates: [{ id: 'followup', name: 'Follow-up baru', body: 'A\nB\nC', order: 1 }],
    });
    const result = reconcileSeeds(local, next);
    expect(result.settings.noteTemplates[0]!.name).toBe('Namaku sendiri');
  });

  it('advances the baseline even when a conflict was not applied', () => {
    /*
     * Otherwise one unresolvable difference becomes a permanent background
     * process, retrying and re-reporting the same conflict on every load.
     */
    const base = seeds();
    const local = settingsFrom(base);
    local.noteTemplates[0]!.body = 'totally rewritten from scratch';
    const next = seeds({
      noteTemplates: [{ id: 'followup', name: 'Follow-up', body: 'Q\nR\nS', order: 1 }],
    });

    const first = reconcileSeeds(local, next);
    expect(first.settings.seedBaseline).toEqual(snapshotOf(next));
    expect(reconcileSeeds(first.settings, next).dirty).toBe(false);
  });

  it('never loses a template body, whatever the outcome', () => {
    const base = seeds();
    const local = settingsFrom(base);
    local.noteTemplates[0]!.body = 'irreplaceable';
    const next = seeds({
      noteTemplates: [{ id: 'followup', name: 'Follow-up', body: '', order: 1 }],
    });
    const result = reconcileSeeds(local, next);
    expect(result.settings.noteTemplates[0]!.body).not.toBe('');
  });

  it('runs clean against the real shipped seeds', () => {
    const fresh = defaultUserSettings();
    const first = reconcileSeeds(fresh, SEED_SNAPSHOT);
    expect(first.settings.noteTemplates).toHaveLength(fresh.noteTemplates.length);
    // Second pass settles: reconciliation must converge, not oscillate.
    expect(reconcileSeeds(first.settings, SEED_SNAPSHOT).dirty).toBe(false);
  });
});

describe('carry-forward clearing reaches existing profiles', () => {
  it('adds ttv to a profile that predates the seeded list', () => {
    /*
     * `carryForwardClearSections` was hardcoded in the defaults factory, so
     * adding `ttv` would only ever have reached brand-new accounts. Seeding it
     * makes the reconciler deliver it — which is the mechanism doing the job
     * it was built for, on the first change shipped after it existed.
     */
    const before = seeds();
    const local = settingsFrom(before);
    // A baseline written before this list was seeded has no entry for it.
    delete local.seedBaseline!.carryForwardClearSections;
    local.carryForwardClearSections = ['s'];

    const result = reconcileSeeds(local, seeds({ carryForwardClearSections: ['s', 'ttv'] }));
    expect(result.settings.carryForwardClearSections).toEqual(['s', 'ttv']);
  });

  it('does not re-add a section the user turned off', () => {
    const base = seeds({ carryForwardClearSections: ['s', 'ttv'] });
    const local = settingsFrom(base);
    local.carryForwardClearSections = ['s'];
    const result = reconcileSeeds(local, base);
    expect(result.settings.carryForwardClearSections).toEqual(['s']);
  });
});

describe('outdatedTemplates / resetTemplateToSeed', () => {
  const base = seeds({
    noteTemplates: [{ id: 'followup', name: 'Follow-up', body: 'A\nB\nC', order: 1 }],
  });

  it('reports a template that differs from what ships today', () => {
    const local = settingsFrom(base);
    local.noteTemplates[0]!.body = 'my own wording';
    expect(outdatedTemplates(local, base).map((t) => t.id)).toEqual(['followup']);
  });

  it('reports nothing when the copy already matches', () => {
    expect(outdatedTemplates(settingsFrom(base), base)).toEqual([]);
  });

  it('ignores a template the user made themselves', () => {
    // No seed to be outdated against.
    const local = settingsFrom(base);
    local.noteTemplates.push({ id: 'mine', name: 'Punyaku', body: 'Z', order: 9 });
    expect(outdatedTemplates(local, base).map((t) => t.id)).toEqual([]);
  });

  it('resets one template and leaves the others alone', () => {
    const local = settingsFrom(base);
    local.noteTemplates[0]!.body = 'my own wording';
    local.noteTemplates.push({ id: 'mine', name: 'Punyaku', body: 'Z', order: 9 });

    const next = resetTemplateToSeed(local, base, 'followup');
    expect(next.find((t) => t.id === 'followup')?.body).toBe('A\nB\nC');
    expect(next.find((t) => t.id === 'mine')?.body).toBe('Z');
  });

  it('keeps the user position in the list', () => {
    /*
     * Resetting the CONTENT of a template is not a request to move it. Where
     * it sits is the user's arrangement.
     */
    const local = settingsFrom(base);
    local.noteTemplates[0] = { ...local.noteTemplates[0]!, body: 'edited', order: 7 };
    expect(resetTemplateToSeed(local, base, 'followup')[0]?.order).toBe(7);
  });
});
