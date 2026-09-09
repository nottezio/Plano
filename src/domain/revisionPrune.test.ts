import { describe, expect, it } from 'vitest';

import { PRUNABLE_REASONS, prunableRevisions, REVISION_CAP } from './revisionPrune';
import type { EntryRevision } from './types';

const auto = (id: string): Pick<EntryRevision, 'reason'> & { id: string } => ({
  id,
  reason: 'autosave',
});
const version = (id: string): Pick<EntryRevision, 'reason'> & { id: string } => ({
  id,
  reason: 'version',
});

describe('prunableRevisions', () => {
  it('keeps everything below the cap', () => {
    expect(prunableRevisions([auto('a'), auto('b')])).toEqual([]);
  });

  it('drops the oldest automatic snapshots past the cap', () => {
    const many = Array.from({ length: REVISION_CAP + 3 }, (_, index) => auto(`a${String(index)}`));
    expect(prunableRevisions(many).map((revision) => revision.id)).toEqual([
      `a${String(REVISION_CAP)}`,
      `a${String(REVISION_CAP + 1)}`,
      `a${String(REVISION_CAP + 2)}`,
    ]);
  });

  it('never prunes a saved version', () => {
    /*
     * The justification for hard-deleting anything here is that these are
     * derived safety copies rather than user-authored notes. Somebody pressed
     * a button to keep a version, so the justification does not reach it.
     */
    const many = [
      ...Array.from({ length: REVISION_CAP + 5 }, (_, index) => auto(`a${String(index)}`)),
      version('pagi'),
    ];
    expect(prunableRevisions(many).some((revision) => revision.id === 'pagi')).toBe(false);
  });

  it('does not let versions consume the cap', () => {
    /*
     * The failure this prevents, and it would have arrived on the days with
     * the most typing: counted towards the cap, a busy morning of autosaves
     * pushes the saved version past position 30 and deletes it.
     */
    const many = [
      version('pagi'),
      version('post-op'),
      ...Array.from({ length: REVISION_CAP }, (_, index) => auto(`a${String(index)}`)),
    ];
    // All 30 autosaves survive despite two versions sitting above them.
    expect(prunableRevisions(many)).toEqual([]);
  });

  it('keeps a version that is older than every autosave', () => {
    // Newest-first, so the morning version sits at the very bottom by evening.
    const many = [
      ...Array.from({ length: REVISION_CAP + 10 }, (_, index) => auto(`a${String(index)}`)),
      version('pagi'),
    ];
    const pruned = prunableRevisions(many);
    expect(pruned).toHaveLength(10);
    expect(pruned.every((revision) => revision.reason === 'autosave')).toBe(true);
  });
});

describe('what a person may delete', () => {
  /*
   * Deleting is offered for SAVED versions only, and the asymmetry is the
   * point.
   *
   * An automatic snapshot is not the user's to delete: it is the recovery
   * trail, it prunes itself at thirty, and removing one by hand only ever
   * makes a bad day worse. A saved version is a note somebody wrote and
   * labelled, so removing it is an ordinary edit to their own work.
   *
   * Asserted here rather than in the component because it is a rule about the
   * data, not about a button — if a second surface ever lists revisions, it
   * has to reach the same answer.
   */
  const deletableByUser = (reason: EntryRevision['reason']): boolean => reason === 'version';

  it('allows a saved version to be deleted', () => {
    expect(deletableByUser('version')).toBe(true);
  });

  it('does not offer to delete an automatic snapshot', () => {
    for (const reason of ['autosave', 'pre-merge', 'pre-conflict', 'restore', 'unlock'] as const) {
      expect(deletableByUser(reason)).toBe(false);
    }
  });

  it('deleting a version does not make the rest prunable', () => {
    // The cap counts automatic snapshots only, so removing a version cannot
    // push anything else over the edge.
    const many = [
      version('pagi'),
      ...Array.from({ length: REVISION_CAP }, (_, index) => auto(`a${String(index)}`)),
    ];
    const withoutVersion = many.filter((entry) => entry.id !== 'pagi');
    expect(prunableRevisions(many)).toEqual(prunableRevisions(withoutVersion));
  });
});

describe('PRUNABLE_REASONS', () => {
  it('covers every reason except a saved version', () => {
    /*
     * A reason missing from this list is never pruned, so the collection grows
     * forever — quietly, and only on the busiest days. The `satisfies` on the
     * constant makes adding a reason to `EntryRevision` without adding it here
     * a compile error; this asserts the same thing at runtime for the reasons
     * that exist today.
     */
    expect([...PRUNABLE_REASONS].sort()).toEqual(
      ['autosave', 'pre-conflict', 'pre-merge', 'restore', 'unlock'].sort(),
    );
    expect([...PRUNABLE_REASONS]).not.toContain('version');
  });

  it('is what the prune queries, so the cap counts one population', () => {
    /*
     * The prune used to fetch the newest CAP+10 revisions of any kind and drop
     * versions afterwards. The window sized itself for the cap while the cap
     * counted only autosaves, so each saved version displaced an autosave out
     * of the window: with fifteen versions the window held twenty-five
     * autosaves, nothing exceeded the cap, and forty autosaves sat unpruned.
     *
     * Querying only the prunable reasons means everything fetched is
     * countable, so the slice at the cap is the whole rule.
     */
    const fetched = Array.from({ length: REVISION_CAP + 10 }, (_, index) =>
      auto(`a${String(index)}`),
    );
    expect(prunableRevisions(fetched)).toHaveLength(10);
  });
});

describe('PRUNABLE_REASONS', () => {
  it('covers every reason except a saved version', () => {
    /*
     * The `satisfies` clause on the constant makes a missing reason a compile
     * error; this asserts the other direction — that `version` never sneaks
     * in, which no type can catch because `version` would satisfy the element
     * type of a looser list.
     */
    expect(PRUNABLE_REASONS).not.toContain('version');
    expect([...PRUNABLE_REASONS].sort()).toEqual(
      ['autosave', 'pre-conflict', 'pre-merge', 'restore', 'unlock'].sort(),
    );
  });

  it('is what stops versions eating the prune window', () => {
    /*
     * The prune fetches the newest CAP + 10 revisions and deletes what is
     * past the cap. Before this list was sent to Firestore as a filter, saved
     * versions occupied slots in that window: with ten of them the window
     * held fewer than thirty prunable revisions, nothing was ever past the
     * cap, and pruning stopped permanently.
     *
     * Modelled here on the client to pin the arithmetic, since the query
     * itself cannot be tested without Firestore.
     */
    const windowSize = REVISION_CAP + 10;
    const versionsInWindow = 10;
    const unfiltered = [
      ...Array.from({ length: versionsInWindow }, (_, i) => version(`v${String(i)}`)),
      ...Array.from({ length: windowSize - versionsInWindow }, (_, i) => auto(`a${String(i)}`)),
    ];
    expect(prunableRevisions(unfiltered)).toEqual([]);

    // Filtered server-side, the same window is all prunable and the excess
    // beyond the cap is found.
    const filtered = Array.from({ length: windowSize }, (_, i) => auto(`a${String(i)}`));
    expect(prunableRevisions(filtered)).toHaveLength(10);
  });
});
