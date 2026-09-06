import { mergeThreeWay } from './merge/threeWayMerge';
import type { NoteTemplate, SectionId, UserSettings } from './types';

/**
 * Letting a corrected seed reach a user who has edited their copy.
 *
 * THE PROBLEM THIS EXISTS FOR
 *
 * Seeded settings — note templates, greetings, opening and closing sentences —
 * were COPIED into the user's profile the first time it was written. From that
 * moment the seed was dead to them: shipping a corrected template changed the
 * constant and nothing else, because the saved copy shadowed it. The only way
 * to take an update was to delete the local copy, which threw away every edit
 * the user had made to it. Fix the format, lose your wording; keep your
 * wording, keep the bug.
 *
 * That is not a missing feature, it is a missing common ancestor. Once the
 * seed has been copied there is no record of what it SAID, so nothing can tell
 * "the user changed this" apart from "this is a stale copy of an old seed".
 * Both look like "local differs from seed".
 *
 * This app already solved that exact problem for clinical notes, because
 * collapsing SOAP into one field removed Firestore's field-level merge and
 * forced a real three-way merge. Settings simply never used it.
 *
 * THE FIX
 *
 * Keep a BASELINE: the seed snapshot the user's settings were last reconciled
 * against. With a base, local and remote copy in hand the question becomes
 * ordinary:
 *
 *   local === base      -> untouched, take the new seed outright
 *   remote === base     -> seed unchanged, leave the user alone
 *   both changed        -> three-way merge, and keep the user's copy if it
 *                          cannot be done cleanly
 *
 * Reconciliation runs on load and is idempotent: once the baseline matches the
 * seeds there is nothing to do, so a user who is up to date pays one set of
 * string comparisons and no writes.
 */

/**
 * The seed snapshot a profile was last reconciled against.
 *
 * Stored centrally rather than as a field on each template, so a user's OWN
 * templates carry no seed machinery at all — they are simply absent from the
 * baseline, which is exactly what "this did not come from a seed" means.
 */
export interface SeedBaseline {
  noteTemplates: { id: string; name: string; body: string }[];
  greetings: string[];
  openingSentences: string[];
  closingSentences: string[];
  /**
   * Optional: baselines written before this list was seeded do not have it.
   * Treated as empty, which makes every seeded entry look "new" and therefore
   * appended — the right outcome, since the user has never been offered them.
   */
  carryForwardClearSections?: SectionId[];
}

/** The seeds as this build ships them. */
export interface SeedSnapshot {
  noteTemplates: readonly NoteTemplate[];
  greetings: readonly string[];
  openingSentences: readonly string[];
  closingSentences: readonly string[];
  carryForwardClearSections: readonly SectionId[];
}

export interface SeedSyncReport {
  /** Names of templates updated from the seed without losing user edits. */
  updated: string[];
  /** Names of templates whose edits could not be merged; local kept as-is. */
  conflicted: string[];
  /** Seeded phrases added or corrected in the string lists. */
  phrases: number;
}

export function snapshotOf(seeds: SeedSnapshot): SeedBaseline {
  return {
    noteTemplates: seeds.noteTemplates.map((template) => ({
      id: template.id,
      name: template.name,
      body: template.body,
    })),
    greetings: [...seeds.greetings],
    openingSentences: [...seeds.openingSentences],
    closingSentences: [...seeds.closingSentences],
    carryForwardClearSections: [...seeds.carryForwardClearSections],
  };
}

/**
 * Merge one string list.
 *
 * Value-based rather than index-based. The lists are short and reorderable,
 * and pairing by position would have treated "user dragged a greeting up the
 * list" as "the seed replaced this entry" — a reorder is not an edit.
 *
 * Three cases, and the third is the one worth stating:
 *
 *  - in the seed but not the baseline -> a NEW phrase. Appended, unless the
 *    user already types it themselves.
 *  - in the baseline but not the seed -> RETIRED. Removed from the user's
 *    list, because the pair (retired, added) is how a CORRECTION arrives: a
 *    seed whose wording changed leaves the old string behind and brings a new
 *    one, and keeping both would leave the user picking from a menu containing
 *    the mistake we just fixed.
 *  - in both -> unchanged by us. If the user deleted it, it stays deleted; if
 *    they edited it, their version stays. Neither is something to undo.
 */
export function mergeStringList<T extends string>(
  baseline: readonly T[],
  local: readonly T[],
  seed: readonly T[],
): { next: T[]; changed: number } {
  const inBaseline = new Set(baseline);
  const inSeed = new Set(seed);
  const inLocal = new Set(local);

  const retired = baseline.filter((value) => !inSeed.has(value));
  const added = seed.filter((value) => !inBaseline.has(value) && !inLocal.has(value));

  const retiredSet = new Set(retired);
  const kept = local.filter((value) => !retiredSet.has(value));
  const removed = local.length - kept.length;

  return { next: [...kept, ...added], changed: removed + added.length };
}

/**
 * Merge the note templates.
 *
 * Matched by `id`, not by name or body — both of those are things the user is
 * expected to change, and matching on a mutable field would make renaming a
 * template look like deleting it and adding a different one.
 */
function mergeTemplates(
  baseline: SeedBaseline,
  local: readonly NoteTemplate[],
  seeds: readonly NoteTemplate[],
): { next: NoteTemplate[]; updated: string[]; conflicted: string[] } {
  const baseById = new Map(baseline.noteTemplates.map((entry) => [entry.id, entry]));
  const localById = new Map(local.map((template) => [template.id, template]));
  const updated: string[] = [];
  const conflicted: string[] = [];

  const next = local.map((template) => {
    const seed = seeds.find((candidate) => candidate.id === template.id);
    const base = baseById.get(template.id);
    // Not a seeded template, or one we have no ancestor for. Either way there
    // is nothing to merge against and inventing a base would be guessing.
    if (!seed || !base) return template;
    if (seed.body === base.body && seed.name === base.name) return template;

    const outcome = mergeThreeWay(base.body, template.body, seed.body);
    /**
     * A conflict keeps the user's copy, silently in the data and loudly in the
     * report.
     *
     * Overwriting would lose work the user cannot get back — settings carry no
     * revision trail, unlike patient entries. Presenting a merge dialog for a
     * template is disproportionate to what is at stake, so the quiet, lossless
     * option wins and the report says which ones went untouched.
     */
    if (outcome.kind === 'conflict') {
      conflicted.push(template.name);
      return template;
    }

    // The name follows only when the user has not renamed it themselves.
    const name = template.name === base.name ? seed.name : template.name;
    const body = outcome.body;
    if (body === template.body && name === template.name) return template;

    updated.push(name);
    return { ...template, name, body };
  });

  /**
   * Seeds the user has never had are added; seeds they DELETED are not.
   *
   * A seed absent from the local list but present in the baseline is one the
   * user removed on purpose, and restoring it on every load would make
   * deletion impossible. That is what the "Kembalikan bawaan" button is for —
   * an explicit request, not a background correction.
   */
  const fresh = seeds.filter(
    (seed) => !localById.has(seed.id) && !baseById.has(seed.id),
  );
  if (fresh.length > 0) {
    const highest = next.reduce((max, template) => Math.max(max, template.order), 0);
    fresh.forEach((seed, offset) => {
      next.push({ ...seed, order: highest + offset + 1 });
      updated.push(seed.name);
    });
  }

  return { next, updated, conflicted };
}

export interface SeedSyncResult {
  settings: UserSettings;
  report: SeedSyncReport;
  /** False when nothing changed, so the caller can skip the write entirely. */
  dirty: boolean;
}

/**
 * Bring a profile's seeded settings up to date, preserving the user's edits.
 *
 * FIRST RUN, for a profile written before baselines existed, records the
 * current seeds as the baseline and changes nothing else. It cannot do better:
 * with no ancestor there is no way to tell an edited template from a stale
 * one, and the safe reading of "local differs from seed" is "the user meant
 * that". Treating it as staleness would overwrite real work on the one run
 * where we know the least. Every seed change after this one merges properly.
 */
export function reconcileSeeds(
  settings: UserSettings,
  seeds: SeedSnapshot,
): SeedSyncResult {
  const current = snapshotOf(seeds);
  const empty: SeedSyncReport = { updated: [], conflicted: [], phrases: 0 };

  if (!settings.seedBaseline) {
    return {
      settings: { ...settings, seedBaseline: current },
      report: empty,
      dirty: true,
    };
  }

  const baseline = settings.seedBaseline;
  const templates = mergeTemplates(baseline, settings.noteTemplates, seeds.noteTemplates);
  const greetings = mergeStringList(baseline.greetings, settings.greetings, seeds.greetings);
  const opening = mergeStringList(
    baseline.openingSentences,
    settings.openingSentences,
    seeds.openingSentences,
  );
  const closing = mergeStringList(
    baseline.closingSentences,
    settings.closingSentences,
    seeds.closingSentences,
  );

  const carry = mergeStringList(
    baseline.carryForwardClearSections ?? [],
    settings.carryForwardClearSections,
    seeds.carryForwardClearSections,
  );

  const phrases = greetings.changed + opening.changed + closing.changed + carry.changed;
  const report: SeedSyncReport = {
    updated: templates.updated,
    conflicted: templates.conflicted,
    phrases,
  };

  /**
   * The baseline advances even when nothing was applied.
   *
   * A conflict, or a seed the user deleted, must not be re-offered on every
   * load — that would turn one unresolvable difference into a permanent
   * background process, retrying forever and reporting the same conflict each
   * time. Advancing the baseline records that this seed version HAS been seen,
   * which is the truth regardless of what was done about it.
   */
  const dirty =
    phrases > 0 ||
    templates.updated.length > 0 ||
    templates.conflicted.length > 0 ||
    JSON.stringify(baseline) !== JSON.stringify(current);

  if (!dirty) return { settings, report: empty, dirty: false };

  return {
    settings: {
      ...settings,
      noteTemplates: templates.next,
      greetings: greetings.next,
      openingSentences: opening.next,
      closingSentences: closing.next,
      carryForwardClearSections: carry.next,
      seedBaseline: current,
    },
    report,
    dirty: true,
  };
}
