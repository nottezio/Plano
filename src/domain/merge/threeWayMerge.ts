import { diff_match_patch, DIFF_DELETE, DIFF_INSERT, type Diff } from 'diff-match-patch';

/**
 * SPEC 7.2 step 5 / 7.3 — the merge.
 *
 * This is the file the whole `localBase` machinery from P1 exists to feed. The
 * base is the last body this device saw the server confirm; local is what the
 * user has on screen; remote is what arrived from another device.
 *
 * Design stance, stated once because every tuning decision below follows from
 * it: **a wrong automatic merge is worse than a prompt.** A resident who is
 * asked "which version?" loses ten seconds. A resident whose plan silently
 * absorbed half of yesterday's plan loses trust in the record, and possibly
 * more than that. So the matcher is deliberately stricter than
 * diff-match-patch's defaults, and every uncertain hunk becomes a conflict
 * rather than a fuzzy application.
 *
 * Nothing here mutates its inputs, and no path discards text without the
 * caller having both versions in hand.
 */

export type MergeOutcome =
  /** Local and remote agree; nothing to do. */
  | { kind: 'unchanged'; body: string }
  /** Only this device changed anything since the base. */
  | { kind: 'local-only'; body: string }
  /** Only the other device changed anything; safe to adopt. */
  | { kind: 'remote-only'; body: string }
  /** Both changed, disjointly. Every hunk applied. */
  | { kind: 'merged'; body: string }
  /**
   * Both changed the same region, or there is no common ancestor. `body` is
   * the best-effort merge and is offered as ONE option — never applied without
   * the user choosing it (SPEC 7.3).
   */
  | {
      kind: 'conflict';
      body: string;
      local: string;
      remote: string;
      base: string | null;
      /** Count of hunks diff-match-patch could not place. */
      failedHunks: number;
      reason: ConflictReason;
    };

export type ConflictReason =
  /** This device has never seen a confirmed server copy of this day. */
  | 'no-base'
  /** Both devices changed the same region of the base. */
  | 'overlap'
  /** A hunk could not be placed at all. */
  | 'unapplied';

/**
 * Stricter than the library defaults (0.5 / 0.5).
 *
 * `Match_Threshold` governs how bad a fuzzy match may be before a hunk is
 * rejected; `Patch_DeleteThreshold` governs the same for deletions. Lowering
 * both trades "merged silently" for "asked the user", which is the trade this
 * app wants everywhere.
 */
const MATCH_THRESHOLD = 0.35;
const PATCH_DELETE_THRESHOLD = 0.35;
/** Clinical notes are short; a wide search window only invites bad matches. */
const MATCH_DISTANCE = 500;

function engine(): InstanceType<typeof diff_match_patch> {
  const dmp = new diff_match_patch();
  dmp.Match_Threshold = MATCH_THRESHOLD;
  dmp.Patch_DeleteThreshold = PATCH_DELETE_THRESHOLD;
  dmp.Match_Distance = MATCH_DISTANCE;
  return dmp;
}

export function mergeThreeWay(
  base: string | null,
  local: string,
  remote: string,
): MergeOutcome {
  if (local === remote) return { kind: 'unchanged', body: local };

  if (base === null) {
    // No common ancestor — this device has never seen a confirmed server copy
    // of this day. Guessing here would be guessing about which of two
    // independently written notes is "the" note.
    return {
      kind: 'conflict',
      body: local,
      local,
      remote,
      base: null,
      failedHunks: 0,
      reason: 'no-base',
    };
  }

  if (remote === base) return { kind: 'local-only', body: local };
  if (local === base) return { kind: 'remote-only', body: remote };

  const dmp = engine();
  // Patch describes "what this device did to the base"; apply it onto remote so
  // the other device's work is the substrate and ours is layered on. Doing it
  // the other way round would bias every conflict toward the local copy.
  const patches = dmp.patch_make(base, local);
  const [mergedText, results] = dmp.patch_apply(patches, remote) as [string, boolean[]];
  const failedHunks = results.filter((applied) => !applied).length;

  /**
   * `patch_apply` returning all-true is NOT a sufficient safety test, and
   * assuming it was is the first thing the tests caught.
   *
   * Because the matcher is fuzzy, a patch can "apply" onto a region the other
   * device also rewrote and produce a mash of both — two devices appending
   * different lines at the same position both report success, and the result
   * is `…lpm LOCAL REMOTE`. Nothing failed; the output is still wrong.
   *
   * So the real test is structural: which ranges OF THE BASE did each side
   * touch? Disjoint ranges are a genuine three-way merge. Overlapping ranges
   * are a decision only the user can make.
   */
  const overlapping = rangesOverlap(touchedRanges(base, local), touchedRanges(base, remote));

  if (!overlapping && failedHunks === 0) {
    return { kind: 'merged', body: mergedText };
  }

  return {
    kind: 'conflict',
    body: mergedText,
    local,
    remote,
    base,
    failedHunks,
    reason: overlapping ? 'overlap' : 'unapplied',
  };
}

/** Half-open `[start, end)` spans of the base that an edit touched. */
type Range = readonly [number, number];

/**
 * Insertions are recorded as zero-width ranges at their anchor point, so two
 * devices inserting at the same spot are detectable as a collision even though
 * neither deleted anything.
 */
function touchedRanges(base: string, other: string): Range[] {
  const dmp = engine();
  // No semantic cleanup: it widens edits into neighbouring text and would turn
  // adjacent-but-independent edits into false conflicts.
  const diffs: Diff[] = dmp.diff_main(base, other);

  const ranges: Range[] = [];
  let cursor = 0;

  for (const [op, text] of diffs) {
    if (op === DIFF_DELETE) {
      ranges.push([cursor, cursor + text.length]);
      cursor += text.length;
    } else if (op === DIFF_INSERT) {
      ranges.push([cursor, cursor]);
    } else {
      cursor += text.length;
    }
  }

  return ranges;
}

/**
 * One character of padding, so an insertion sitting exactly where the other
 * side deleted counts as a collision. Anything wider would start reporting
 * edits on adjacent lines as conflicts.
 */
const OVERLAP_PADDING = 1;

function rangesOverlap(left: readonly Range[], right: readonly Range[]): boolean {
  for (const [aStart, aEnd] of left) {
    for (const [bStart, bEnd] of right) {
      if (
        aStart - OVERLAP_PADDING <= bEnd + OVERLAP_PADDING &&
        bStart - OVERLAP_PADDING <= aEnd + OVERLAP_PADDING
      ) {
        return true;
      }
    }
  }
  return false;
}

/** True when the outcome can be applied with no user decision (SPEC 7.2). */
export function isAutomatic(outcome: MergeOutcome): boolean {
  return outcome.kind !== 'conflict';
}

export interface DiffSegment {
  type: 'equal' | 'insert' | 'delete';
  text: string;
}

/**
 * SPEC 7.3 — "Lihat perbedaan".
 *
 * Word-level semantic diff rather than character-level: character diffs of
 * prose produce unreadable confetti, and the person reading this is deciding
 * which version of a clinical note to keep.
 */
export function diffSegments(before: string, after: string): DiffSegment[] {
  const dmp = engine();
  const diffs = dmp.diff_main(before, after);
  dmp.diff_cleanupSemantic(diffs);

  return diffs.map(([op, text]) => ({
    type: op === DIFF_INSERT ? 'insert' : op === DIFF_DELETE ? 'delete' : 'equal',
    text,
  }));
}

/** Characters added and removed — used to label the conflict options. */
export function diffStats(before: string, after: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const segment of diffSegments(before, after)) {
    if (segment.type === 'insert') added += segment.text.length;
    if (segment.type === 'delete') removed += segment.text.length;
  }
  return { added, removed };
}

/**
 * Last-resort option for a conflict the user does not want to adjudicate:
 * keep BOTH, clearly labelled, and let them delete what they do not need.
 *
 * Ugly on purpose. It is the only resolution that provably loses nothing, so
 * it must always be reachable — SPEC 1.5 forbids silent loss, not ugliness.
 */
export function keepBoth(local: string, remote: string, otherDeviceLabel: string): string {
  return [
    '=== Versi perangkat ini ===',
    local.trimEnd(),
    '',
    `=== Versi ${otherDeviceLabel} ===`,
    remote.trimEnd(),
    '',
  ].join('\n');
}

/**
 * Line-level diff, for reading two notes side by side.
 *
 * `diffSegments` above is character-level with `diff_cleanupSemantic`, which
 * is right for a merge conflict — the finer the granularity, the smaller the
 * thing you have to adjudicate. It is wrong for a note.
 *
 * Two reasons. Character diffing finds coincidental matches between unrelated
 * lines, so adding a bullet at the top of a plan leaves the lines below
 * shredded into little inserts and deletes that read as edits nobody made. And
 * `diff_cleanupSemantic` deliberately merges small equalities INTO the
 * surrounding change to make the result more readable as prose, which turns a
 * line that merely moved down into a delete on one side and an insert on the
 * other.
 *
 * Line mode compares whole lines as indivisible units, so inserting a line
 * above existing ones marks exactly that one line inserted and leaves the rest
 * equal — which is what actually happened.
 *
 * `diff_cleanupSemantic` is deliberately NOT called: it would undo the line
 * grouping this exists to produce.
 */
export function diffSegmentsByLine(before: string, after: string): DiffSegment[] {
  const dmp = engine();

  // `diff_linesToChars_` maps each distinct line to one character, so the
  // character diff below is really a line diff.
  const encoded = dmp.diff_linesToChars_(before, after);
  const diffs = dmp.diff_main(encoded.chars1, encoded.chars2, false);
  dmp.diff_charsToLines_(diffs, encoded.lineArray);

  return diffs.map(([op, text]) => ({
    type: op === DIFF_INSERT ? 'insert' : op === DIFF_DELETE ? 'delete' : 'equal',
    text,
  }));
}
