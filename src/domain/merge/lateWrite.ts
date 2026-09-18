import { mergeThreeWay } from './threeWayMerge';

/**
 * What to do with a body write that did not land when it was made.
 *
 * THE BUG THIS EXISTS FOR
 *
 * A body write is unconditional: the whole text, last writer wins. Firestore's
 * queue is persistent, so a write made with no signal is delivered whenever
 * that device next reconnects — which can be hours later, after the same note
 * has been edited somewhere else. The late write then replaces the newer text
 * and the note "reverts".
 *
 * The three-way merge already in this folder cannot help there: it runs inside
 * a live editor holding both versions, and a queued write left the app long
 * ago. So writes are recorded in an outbox with the base they were built on,
 * and this decides what happens when one is found still outstanding.
 *
 * FOUR OUTCOMES, ALL OF WHICH KEEP BOTH SIDES
 *
 *   landed    the server already holds this text; drop the record
 *   rewrite   the server still holds the base, so the write never arrived
 *   merge     the server moved and the two sides changed DIFFERENT lines
 *   review    they touched the same line; the offline text goes to the
 *             revision trail and the person decides
 *
 * STRICTER THAN THE LIVE MERGE, ON PURPOSE
 *
 * `mergeThreeWay` is character-level. Asked to combine "Aspilet 160 mg" with
 * "Aspilet 80 mg + CPG" it returns a merged line, and in the editor that is
 * fine: the result is on screen and can be read before it is kept. Here there
 * is nobody watching — this runs at startup, possibly days later — and the
 * text is a drug line. A dose neither doctor wrote must never be written by
 * a background task. So a late write is merged only when the two sides
 * changed different lines; anything closer than that is handed back.
 */
export type LateWritePlan =
  | { kind: 'landed' }
  | { kind: 'rewrite'; body: string; base: string }
  | { kind: 'merge'; body: string; base: string; replaced: string }
  | { kind: 'review'; body: string; server: string };

export function planLateWrite(input: {
  /** The body this device wrote and never saw confirmed. */
  body: string;
  /** The last body this device had SEEN THE SERVER CONFIRM when it wrote. */
  base: string;
  /** What the server holds now. */
  server: string;
}): LateWritePlan {
  const { body, base, server } = input;

  // Identical text is not a change, whoever wrote it. Covers the ordinary
  // case where the queued write arrived normally while the app was closed.
  if (server === body) return { kind: 'landed' };

  // The server is still where it was: our write never arrived, or was refused.
  // Writing it now is the same write, just late, and nothing else is lost.
  if (server === base) return { kind: 'rewrite', body, base };

  if (sameLineTouched(base, body, server)) return { kind: 'review', body, server };

  const outcome = mergeThreeWay(base, body, server);
  switch (outcome.kind) {
    case 'unchanged':
    case 'remote-only':
      // The server's version already contains ours, or ours changed nothing.
      return { kind: 'landed' };
    case 'local-only':
    case 'merged':
      // `base` for the new write is what the server holds NOW, so the write
      // is a compare-and-set against the version it was merged against. If
      // the server moves again in between, that write is refused and this
      // runs again rather than overwriting the newer text.
      return { kind: 'merge', body: outcome.body, base: server, replaced: server };
    case 'conflict':
    default:
      return { kind: 'review', body, server };
  }
}

/** Lines of `base` that `text` no longer has, counted, so duplicates behave. */
function removedLines(base: string, text: string): Map<string, number> {
  const remaining = new Map<string, number>();
  for (const line of text.split('\n')) remaining.set(line, (remaining.get(line) ?? 0) + 1);

  const removed = new Map<string, number>();
  for (const line of base.split('\n')) {
    const left = remaining.get(line) ?? 0;
    if (left > 0) {
      remaining.set(line, left - 1);
      continue;
    }
    if (line.trim().length === 0) continue; // Blank lines are layout, not content.
    removed.set(line, (removed.get(line) ?? 0) + 1);
  }
  return removed;
}

/** Did both sides change or delete the same line of the base? */
function sameLineTouched(base: string, local: string, remote: string): boolean {
  if (base.length === 0) return true; // No common ancestor: nothing to merge against.
  const mine = removedLines(base, local);
  for (const line of removedLines(base, remote).keys()) {
    if (mine.has(line)) return true;
  }
  return false;
}
