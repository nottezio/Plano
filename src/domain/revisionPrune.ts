import type { EntryRevision } from './types';

/** SPEC 7.4 — automatic snapshots kept per day. */
export const REVISION_CAP = 30;

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
