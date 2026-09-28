import { FieldPath, deleteField, setDoc, updateDoc } from 'firebase/firestore';
import { nanoid } from 'nanoid';

import { userDoc } from '../paths';
import { trackWrite } from '../syncStatus';
import type { NoteRecord, ResolvedNote } from '@/domain/notes/scratchNotes';

/**
 * Catatan writes. Each change touches only the fields it changes, under
 * `notesById.<id>`, so a body save, a rename and a reorder landing together
 * cannot overwrite one another. See `domain/notes/scratchNotes` for why.
 */

export function createScratchNote(
  uid: string,
  record: Omit<NoteRecord, 'createdAt' | 'updatedAt'>,
): string {
  const id = `n${nanoid(8)}`;
  const now = Date.now();
  void trackWrite(
    updateDoc(userDoc(uid), new FieldPath('notesById', id), {
      ...record,
      createdAt: now,
      updatedAt: now,
    }),
  ).catch((error: unknown) => console.error('[catatan] create rejected', error));
  return id;
}

/** A change to some fields; `undefined` clears a field. */
export type NotePatch = { [K in keyof NoteRecord]?: NoteRecord[K] | undefined };

/** Legacy notes already copied into the map by this session. */
const materialised = new Set<string>();

/** Fields whose change counts as editing the note ("diubah 3 mnt"). */
const TOUCHES: ReadonlyArray<keyof NoteRecord> = ['title', 'body'];

/**
 * Change some fields of one note.
 *
 * A legacy note (still only in the old array) is copied into the map whole,
 * with the change applied, in one merge write: writing a single leaf under a
 * map entry that does not exist yet would create an entry holding ONLY that
 * leaf — a note with a body and no title, shelf or order.
 *
 * `undefined` in the patch clears the field (`deleteField`).
 */
export function patchScratchNote(
  uid: string,
  note: ResolvedNote,
  patch: NotePatch,
): Promise<void> {
  const touched = TOUCHES.some((key) => key in patch);
  const full: NotePatch = touched ? { ...patch, updatedAt: Date.now() } : { ...patch };

  /*
    Copied once, then leaf writes. Until the snapshot echoes the copy back the
    note still RESOLVES as legacy, and a second whole-note copy (a rename a
    moment after a body save) would carry the old body and overwrite the first
    — the very race this storage exists to remove.
  */
  if (note.legacy && !materialised.has(note.id)) {
    materialised.add(note.id);
    const { id: _id, legacy: _legacy, ...record } = note;
    const merged: Record<string, unknown> = { ...record, ...full };
    for (const key of Object.keys(merged)) {
      if (merged[key] === undefined) delete merged[key];
    }
    return trackWrite(setDoc(userDoc(uid), { notesById: { [note.id]: merged } }, { merge: true }));
  }

  const pairs: unknown[] = [];
  for (const [key, value] of Object.entries(full)) {
    pairs.push(new FieldPath('notesById', note.id, key), value === undefined ? deleteField() : value);
  }
  if (pairs.length === 0) return Promise.resolve();
  const [field, value, ...more] = pairs as [FieldPath, unknown, ...unknown[]];
  return trackWrite(updateDoc(userDoc(uid), field, value, ...more));
}

/**
 * Remove a note for good — only from Sampah, only by an explicit press.
 * The purge half of trash-then-purge: title and body are gone.
 *
 * A tombstone, not `deleteField()`. A note that started in the legacy array is
 * still in that array (it is never rewritten), so removing the map entry would
 * bring the old copy straight back. The tombstone keeps the id claimed.
 */
export function purgeScratchNote(uid: string, id: string): Promise<void> {
  return trackWrite(
    updateDoc(userDoc(uid), new FieldPath('notesById', id), { purgedAt: Date.now() }),
  );
}
