import {
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { helperResultDoc, helperResultsCol } from '../paths';
import { trackWrite } from '../syncStatus';
import {
  MAX_RESULT_CHARS,
  helperResultId,
  readHelperResult,
  type HelperResult,
  type HelperResultKind,
} from '@/domain/helperResults';

/**
 * Firestore access for saved Helper results. Path: `users/{uid}/helperResults/{id}`.
 *
 * Writes are fire-and-forget through `trackWrite`, like every other save in
 * the app: Firestore's offline cache applies them locally at once (the list
 * updates before the server has answered) and delivers them when online, and
 * the sync pill counts them while they wait.
 */

export interface SaveInput {
  kind: HelperResultKind;
  forDate: string;
  subject: string;
  title: string;
  text: string;
}

/**
 * Save, or re-save, the result for this kind/date/subject.
 *
 * A whole-document `setDoc`, not a merge: every field is the tool's current
 * answer, and a merge would keep an `editedAt` from an edit this save
 * replaces.
 */
export function saveHelperResult(uid: string, input: SaveInput): { id: string; written: Promise<void> } {
  const id = helperResultId(input.kind, input.forDate, input.subject);
  const written = trackWrite(
    setDoc(helperResultDoc(uid, id), {
      kind: input.kind,
      forDate: input.forDate,
      subject: input.subject,
      title: input.title.trim(),
      text: input.text.slice(0, MAX_RESULT_CHARS),
      savedAt: Date.now(),
      editedAt: null,
      deletedAt: null,
      updatedAt: serverTimestamp(),
    }),
  );
  return { id, written };
}

/** A correction typed on the Tersimpan tab. */
export function editHelperResult(
  uid: string,
  id: string,
  patch: { title?: string; text?: string },
): Promise<void> {
  return trackWrite(
    updateDoc(helperResultDoc(uid, id), {
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.text !== undefined ? { text: patch.text.slice(0, MAX_RESULT_CHARS) } : {}),
      editedAt: Date.now(),
      updatedAt: serverTimestamp(),
    }),
  );
}

/** Soft delete (SPEC 1.5); the rules refuse a real one. */
export function deleteHelperResult(uid: string, id: string): Promise<void> {
  return trackWrite(
    updateDoc(helperResultDoc(uid, id), { deletedAt: Date.now(), updatedAt: serverTimestamp() }),
  );
}

export function restoreHelperResult(uid: string, id: string): Promise<void> {
  return trackWrite(
    updateDoc(helperResultDoc(uid, id), { deletedAt: null, updatedAt: serverTimestamp() }),
  );
}

/**
 * The newest 300, deleted ones included (the caller filters). One `orderBy`
 * on one field needs no composite index, so there is nothing to deploy but
 * the rules. 300 is about three months of one census and a few messages a
 * day; older ones stay stored and come back if newer ones are deleted.
 */
export const RESULT_LIMIT = 300;

export function subscribeHelperResults(
  uid: string,
  callback: (results: HelperResult[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(helperResultsCol(uid), orderBy('savedAt', 'desc'), limit(RESULT_LIMIT)),
    (snapshot) =>
      callback(
        snapshot.docs
          .map((entry) => readHelperResult(entry.id, entry.data()))
          .filter((result): result is HelperResult => result !== null),
      ),
    onError,
  );
}
