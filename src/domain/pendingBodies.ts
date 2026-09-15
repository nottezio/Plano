export interface Bodied {
  id: string;
  body: string;
}

/**
 * Apply writes that have not come back from the server yet.
 *
 * THE BUG THIS FIXES
 *
 * The Catatan notes live in ONE document as an array, so saving any note means
 * rewriting all of them. Each save built that array from the `notes` value its
 * own render closed over — and on a tab switch two saves happen in quick
 * succession: a flush for the note being left, then a save for the note being
 * entered.
 *
 * The second save's array came from a render that had not yet seen the first
 * save echo back from Firestore, so it carried the OLD body for the note just
 * left. The checklist somebody had added seconds earlier was overwritten by a
 * copy of the note as it was before. Read-modify-write on a shared document,
 * with the read too old.
 *
 * It was intermittent because it depends on whether the subscription echoed
 * between the two writes — which on a fast connection it usually does.
 *
 * The fix is to remember what has been sent and not yet confirmed, and to
 * replay it over every subsequent array. A pending body is the truth until the
 * server says the same thing back.
 */
export function applyPending<T extends Bodied>(
  notes: readonly T[],
  pending: ReadonlyMap<string, string>,
): T[] {
  if (pending.size === 0) return [...notes];
  return notes.map((note) => {
    const body = pending.get(note.id);
    return body === undefined || body === note.body ? note : { ...note, body };
  });
}

/**
 * Drop the entries the server has now confirmed.
 *
 * Compared by VALUE rather than cleared on write completion. A resolved
 * promise says the request was accepted, not that this is what the document
 * now holds — another device may have written in between, and in that case the
 * pending value is genuinely stale and must stop being replayed.
 */
export function settlePending<T extends Bodied>(
  notes: readonly T[],
  pending: Map<string, string>,
): void {
  for (const note of notes) {
    if (pending.get(note.id) === note.body) pending.delete(note.id);
  }
}
