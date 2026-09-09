import type { EntryRevision } from './types';

/** SPEC 7.4 — automatic snapshots kept per day. */
export const REVISION_CAP = 30;

/**
 * The reasons a revision may be pruned — everything except a saved version.
 *
 * Listed explicitly rather than derived as "not version", because the prune
 * QUERIES on it: Firestore needs the set enumerated, and an inequality would
 * force the ordering to start with `reason` and lose the `at` ordering the
 * prune depends on to remove the oldest.
 *
 * A new reason added to `EntryRevision` must be added here too, or it will
 * never be pruned. The type below makes that a compile error rather than a
 * collection that quietly grows forever.
 */
export const PRUNABLE_REASONS = [
  'autosave',
  'pre-merge',
  'pre-conflict',
  'restore',
  'unlock',
] as const satisfies readonly Exclude<EntryRevision['reason'], 'version'>[];

/**
 * Which revisions may be deleted when the trail is trimmed.
 *
 * Extracted from the repository so it can be tested without Firestore, because
 * getting it wrong deletes a note rather than degrading a feature.
 *
 * The rule is one sentence: a SAVED VERSION is never prunable. The
 * justification for hard-deleting anything here is that these are derived
 * safety copies rather than user-authored notes — and a version is
 * user-authored, since somebody pressed a button to keep it. The justification
 * simply does not reach it.
 *
 * Versions are also excluded BEFORE the cap is applied, not merely skipped
 * while deleting. Counted towards the cap, a busy day of autosaves would push
 * the morning SOAP past position 30 and delete it — the exact failure the
 * feature exists to prevent, arriving quietly on the days with the most typing.
 */
export function prunableRevisions<T extends Pick<EntryRevision, 'reason'>>(
  newestFirst: readonly T[],
  cap: number = REVISION_CAP,
): T[] {
  return newestFirst.filter((revision) => revision.reason !== 'version').slice(cap);
}
