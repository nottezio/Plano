import {
  addDoc,
  deleteDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';

import { getDeviceId } from '../deviceId';
import { entriesCol, entryDoc, revisionsCol } from '../paths';
import { touchEntryMeta } from './patients.repo';
import { putMergeBase } from '../localBase';
import { trackWrite } from '../syncStatus';
import { bodyHash } from '@/domain/hash';
import type { ClinicalDate, DailyEntry, EntryRevision, ShiftNote } from '@/domain/types';

/** Cap from SPEC 7.4. Oldest pruned on append. */
const REVISION_CAP = 30;

export interface EntrySnapshot {
  entry: DailyEntry | null;
  exists: boolean;
  fromCache: boolean;
  hasPendingWrites: boolean;
}

/**
 * Subscribes to one clinical day.
 *
 * `includeMetadataChanges` is required, not cosmetic: SPEC 7.2 step 4 says the
 * merge base is persisted on *write confirmation*, and the only signal for
 * that is a metadata-only snapshot flipping `hasPendingWrites` to false.
 * Without it the base would never advance and every reconnect would look like
 * a conflict.
 */
export function subscribeEntry(
  patientId: string,
  date: ClinicalDate,
  callback: (snapshot: EntrySnapshot) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    entryDoc(patientId, date),
    { includeMetadataChanges: true },
    (snapshot) => {
      const entry = snapshot.exists() ? (snapshot.data() as DailyEntry) : null;

      // Confirmed server state → this is now the common ancestor for merge.
      if (entry && !snapshot.metadata.hasPendingWrites && !snapshot.metadata.fromCache) {
        void putMergeBase({
          patientId,
          date,
          body: entry.body,
          rev: entry.rev,
        });
      }

      callback({
        entry,
        exists: snapshot.exists(),
        fromCache: snapshot.metadata.fromCache,
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
      });
    },
    onError,
  );
}

/**
 * One-shot read of every day, for the copy sheet's range options.
 *
 * `getDocs` serves from the persistent cache when offline, so "salin 3 hari
 * terakhir" works with no signal — which is the only reason this is a fetch
 * rather than a subscription.
 */
export async function fetchEntryBodies(
  patientId: string,
): Promise<Array<{ date: ClinicalDate; body: string }>> {
  const snapshot = await getDocs(query(entriesCol(patientId), orderBy('date', 'desc')));
  return snapshot.docs
    .map((entry) => entry.data() as DailyEntry)
    // `!entry.deletedAt`, not `=== null`. Only the creation path sets the field
    // explicitly; a document first materialised by a merge write — locking an
    // untouched day does exactly that — has it `undefined`. The strict
    // comparison discarded every one of those, which is why "salin dari hari
    // sebelumnya" reported that there was nothing to copy.
    .filter((entry) => !entry.deletedAt)
    /**
     * `body ?? ''`, and body-less days dropped.
     *
     * An entry document can legitimately exist with no `body` field at all:
     * `writeShiftNotes` materialises one when a jaga note is added to a day
     * that has no SOAP yet, and locking an untouched day does the same. This
     * function used to hand those straight on as `{ date, body: undefined }`,
     * and every consumer assumed a string — `composeCopy` called `body.trim()`
     * and threw, so Salin rendered EMPTY for a day the editor was visibly
     * showing text for.
     *
     * Dropping them also settles a disagreement. `subscribeEntryDates` already
     * filters on a non-empty body, so the rail knew such a day had no note
     * while `resolveRange` here matched it on date alone and returned it as
     * the day to copy. Two code paths held different answers to "which days
     * have a note", and the copy path had the wrong one.
     */
    .map((entry) => ({ date: entry.date, body: entry.body ?? '' }))
    .filter((entry) => entry.body.trim().length > 0);
}

/**
 * Dates that actually have a note.
 *
 * A document existing is not the same as a day having content: locking an
 * untouched day, or opening one and typing nothing, both leave an empty
 * document behind. Listing those put dates on the rail that lead to a blank
 * page, which is exactly what the rail is supposed to save you from.
 */
export interface EntryDatesSnapshot {
  /** Days with a non-empty body — what the rail marks as having content. */
  dates: ClinicalDate[];
  /**
   * Shift notes per day, for the rail's half-height entries.
   *
   * Carried by this subscription rather than a second one: it already reads
   * every entry document in the patient, so the notes are in hand and a
   * parallel query would be a second live listener for data already on the
   * wire.
   *
   * A day appears here whether or not its BODY has content — a jaga complaint
   * can be the first thing written against a date, and a shift note that
   * existed but did not show because nobody had written the day's SOAP yet
   * would look exactly like a lost note.
   */
  shiftNotesByDate: Record<ClinicalDate, ShiftNote[]>;
}

export function subscribeEntryDates(
  patientId: string,
  callback: (snapshot: EntryDatesSnapshot) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(entriesCol(patientId), orderBy('date', 'desc')),
    (snapshot) => {
      const dates: ClinicalDate[] = [];
      const shiftNotesByDate: Record<ClinicalDate, ShiftNote[]> = {};

      for (const entry of snapshot.docs) {
        const data = entry.data() as DailyEntry;
        if (data.deletedAt) continue;

        if ((data.body ?? '').trim().length > 0) dates.push(entry.id);

        const live = (data.shiftNotes ?? []).filter((note) => note.clearedAt === null);
        if (live.length > 0) shiftNotesByDate[entry.id] = live;
      }

      callback({ dates, shiftNotesByDate });
    },
    onError,
  );
}

/**
 * SPEC 7.2 step 3 — the single body write.
 *
 * `setDoc({ merge: true })` rather than `updateDoc` so that the first write of
 * a new clinical day creates the document. The doc id IS the date, so this is
 * an idempotent upsert: two devices creating "today" offline converge on one
 * document instead of racing to produce duplicates.
 *
 * `rev` uses `increment(1)` so concurrent writers cannot both land on the same
 * revision number, and `updatedAt` uses `serverTimestamp()` because a device
 * clock must never order a conflict resolution (SPEC 7.4).
 */
export interface WriteBodyOptions {
  /**
   * True when the caller's live snapshot says this day does not exist yet.
   * Creation-only fields are then included; on every subsequent write they are
   * omitted so a keystroke flush can never resurrect a soft-deleted entry or
   * silently unlock a locked one.
   */
  isNew: boolean;
}

export function writeBody(
  patientId: string,
  date: ClinicalDate,
  body: string,
  hariRawat: number,
  options: WriteBodyOptions,
): Promise<void> {
  const payload: DocumentData = {
    date,
    hariRawat,
    body,
    bodyHash: bodyHash(body),
    rev: increment(1),
    updatedAt: serverTimestamp(),
    updatedBy: getDeviceId(),
  };

  if (options.isNew) {
    payload['createdAt'] = serverTimestamp();
    payload['locked'] = false;
    payload['editing'] = null;
    payload['deletedAt'] = null;
  }

  // Two writes, deliberately. The board reads the patient document only, so
  // the preview has to travel with the body or the card goes stale. Both are
  // optimistic and both queue offline, so this costs latency nowhere.
  const written = trackWrite(setDoc(entryDoc(patientId, date), payload, { merge: true }));
  void touchEntryMeta(patientId, date, body);
  return written;
}

/**
 * Materialises an empty day (used by carry-forward and templates).
 *
 * Firestore has no offline-safe "create if absent" — a transaction needs the
 * network, which SPEC 1.2 forbids depending on. So existence is decided from
 * the caller's live snapshot instead. The worst case when two devices create
 * the same day offline is a duplicated `createdAt`, which is diagnostic only:
 * the clinical date is the document id, so the two writes converge on one
 * document rather than forking.
 */
export function createEntry(
  patientId: string,
  date: ClinicalDate,
  hariRawat: number,
  initialBody = '',
): Promise<void> {
  return trackWrite(
    setDoc(
      entryDoc(patientId, date),
      {
        date,
        hariRawat,
        body: initialBody,
        bodyHash: bodyHash(initialBody),
        rev: 0,
        locked: false,
        editing: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: getDeviceId(),
        deletedAt: null,
      },
      { merge: true },
    ),
  );
}

/** SPEC 7.5 — soft presence. A hint, never a lock. */
export function heartbeatEditing(patientId: string, date: ClinicalDate): Promise<void> {
  return trackWrite(
    setDoc(
      entryDoc(patientId, date),
      { editing: { deviceId: getDeviceId(), at: serverTimestamp() } },
      { merge: true },
    ),
  );
}

export function clearEditing(patientId: string, date: ClinicalDate): Promise<void> {
  return trackWrite(
    setDoc(entryDoc(patientId, date), { editing: null }, { merge: true }),
  );
}

/**
 * Lock or unlock a day.
 *
 * `setDoc(..., { merge: true })`, not `updateDoc`, because the document may not
 * exist. Auto-lock is DERIVED from the date — a day older than 48 hours reads
 * as locked whether or not anything was ever written to it. So "Buka kunci" on
 * an empty old day was calling `updateDoc` on a non-existent document, which
 * rejects with "No document to update", and the rejection was unhandled: the
 * button did nothing at all, silently.
 *
 * Merging also means unlocking never touches `body` or `rev`.
 */
export function setEntryLocked(
  patientId: string,
  date: ClinicalDate,
  locked: boolean,
): Promise<void> {
  return trackWrite(
    setDoc(
      entryDoc(patientId, date),
      {
        locked,
        updatedAt: serverTimestamp(),
        updatedBy: getDeviceId(),
      },
      { merge: true },
    ),
  );
}

export function softDeleteEntry(patientId: string, date: ClinicalDate): Promise<void> {
  return trackWrite(
    updateDoc(entryDoc(patientId, date), {
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: getDeviceId(),
    }),
  );
}

/**
 * SPEC 7.4 — the revision trail. This is the last line of defence against
 * losing text, so it is appended BEFORE any merge or conflict resolution, not
 * after.
 */
export async function appendRevision(
  patientId: string,
  date: ClinicalDate,
  revision: Pick<EntryRevision, 'body' | 'rev' | 'reason'>,
): Promise<void> {
  await trackWrite(
    addDoc(revisionsCol(patientId, date), {
      body: revision.body,
      rev: revision.rev,
      reason: revision.reason,
      deviceId: getDeviceId(),
      at: serverTimestamp(),
    }),
  );
  await pruneRevisions(patientId, date);
}

async function pruneRevisions(patientId: string, date: ClinicalDate): Promise<void> {
  try {
    const snapshot = await getDocs(
      query(revisionsCol(patientId, date), orderBy('at', 'desc'), limit(REVISION_CAP + 10)),
    );
    const excess = snapshot.docs.slice(REVISION_CAP);
    // Pruning the oldest snapshots past the cap is the one place a hard delete
    // is correct: these are derived safety copies, not user-authored notes,
    // and they are removed newest-last so the recent trail always survives.
    await Promise.all(excess.map((entry) => deleteDoc(entry.ref)));
  } catch (error) {
    console.error('[entries] revision prune failed', error);
  }
}

export function subscribeRevisions(
  patientId: string,
  date: ClinicalDate,
  callback: (revisions: EntryRevision[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(revisionsCol(patientId, date), orderBy('at', 'desc'), limit(REVISION_CAP)),
    (snapshot) =>
      callback(
        snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as EntryRevision),
      ),
    onError,
  );
}

/**
 * Clear a day's note.
 *
 * Soft, like everything else here: the entry document stays and its body is
 * emptied, so the revision trail for that day survives and the text can be
 * recovered from it. A hard delete would take the trail with it, and the trail
 * is the only reason an accidental clear is not permanent.
 *
 * The `deletedAt` marker is what hides it from the rail and from
 * "salin dari hari sebelumnya".
 */
export function clearEntry(patientId: string, date: ClinicalDate): Promise<void> {
  return trackWrite(
    setDoc(
      entryDoc(patientId, date),
      {
        body: '',
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: getDeviceId(),
      },
      { merge: true },
    ),
  );
}

/**
 * Write the whole `shiftNotes` array.
 *
 * Whole-array, not per-element. Firestore has no "update element 2 of an
 * array" — `arrayUnion` matches on deep equality, so editing a note's text
 * would append a second copy rather than replace it. Writing the array back
 * whole is the only correct option, and the reason `ShiftNote.id` exists is so
 * the caller can rebuild it without depending on position.
 *
 * `rev` is NOT incremented and `bodyHash` is NOT touched. Both describe the
 * SOAP body, which three-way merge operates on; a shift note is a sibling
 * field, and bumping the body's revision because a shift note changed would
 * make the merge think the body moved when it did not. Firestore merges these
 * fields independently, which is the whole reason this is a field rather than
 * text appended to the body.
 *
 * `merge: true` because the day may not exist yet — a jaga complaint can be
 * the first thing written against a date. `updateDoc` with a dotted path fails
 * silently on a missing document (§4), which is exactly the trap this avoids.
 */
export function writeShiftNotes(
  patientId: string,
  date: ClinicalDate,
  hariRawat: number,
  shiftNotes: ShiftNote[],
): Promise<void> {
  return trackWrite(
    setDoc(
      entryDoc(patientId, date),
      {
        date,
        hariRawat,
        shiftNotes,
        /**
         * `body` is deliberately NOT written here.
         *
         * A first attempt at fixing the empty-Salin bug added `body: ''` to
         * this payload so the document would never exist without the field.
         * That would have wiped the day's SOAP on every shift-note write:
         * `merge: true` merges FIELDS, so `body: ''` is not "leave it alone if
         * present", it is "set it to empty". Adding a jaga note to a day that
         * already had a note would have deleted the note.
         *
         * The document genuinely can exist without a body — adding a jaga note
         * to an untouched day creates exactly that — so the fix belongs in the
         * readers, which must not assume the field is present. See
         * `fetchEntryBodies`.
         */
        updatedAt: serverTimestamp(),
        updatedBy: getDeviceId(),
      },
      { merge: true },
    ),
  );
}
