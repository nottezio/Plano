import { useCallback, useMemo, useRef, useState } from 'react';
import { Timestamp } from 'firebase/firestore';

import { writeShiftNotes } from '@/data/repositories/entries.repo';
import {
  formatShiftTime,
  newShiftNoteId,
  visibleShiftNotes,
} from '@/domain/shiftNotes';
import type { ClinicalDate, DailyEntry, ShiftNote } from '@/domain/types';

export interface ShiftNotesState {
  notes: ShiftNote[];
  /** Returns the new note's id, so the caller can open it immediately. */
  add: () => string | null;
  setBody: (id: string, body: string) => void;
  clear: (id: string) => void;
  flush: () => void;
}

/**
 * Shift note editing for one day.
 *
 * Separate from `useEntry`, which subscribes and does not write. Keeping the
 * mutation here means the read path stays one thing that cannot accidentally
 * gain a write.
 *
 * Text is held locally while typing and written on flush (blur), matching how
 * the body editor already behaves. A write per keystroke on a whole-array
 * field would be a document write per character.
 */
export function useShiftNotes(
  patientId: string | undefined,
  date: ClinicalDate,
  entry: DailyEntry | null,
  hariRawat: number,
  readOnly: boolean,
): ShiftNotesState {
  const stored = useMemo(() => entry?.shiftNotes ?? [], [entry?.shiftNotes]);

  /**
   * Unflushed local edits, by id.
   *
   * Held in state so the textarea is controlled, and merged OVER the stored
   * array on read. Without this, every keystroke would be reverted by the next
   * snapshot until the debounce landed.
   */
  const [draft, setDraft] = useState<Record<string, string>>({});
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const notes = useMemo(
    () =>
      visibleShiftNotes(stored).map((note) =>
        draft[note.id] === undefined ? note : { ...note, body: draft[note.id]! },
      ),
    [stored, draft],
  );

  /**
   * Rebuilds the FULL array from storage, applying one change.
   *
   * Built from `stored` rather than from `notes`, because `notes` excludes
   * cleared entries — writing that back would hard-delete them, and nothing in
   * this app is hard-deleted (§5). The revision trail is the only reason an
   * accidental clear is recoverable.
   */
  const commit = useCallback(
    (mutate: (current: ShiftNote[]) => ShiftNote[]) => {
      if (!patientId || readOnly) return;
      void writeShiftNotes(patientId, date, hariRawat, mutate([...stored]));
    },
    [patientId, date, hariRawat, readOnly, stored],
  );

  const add = useCallback(() => {
    if (!patientId || readOnly) return null;
    const at = new Date();
    // Generated OUTSIDE `commit` so it can be returned. The caller needs it to
    // open the note straight away — a new empty box added to a list and left
    // unopened is one you have to go and find, and the reason for adding it
    // was that you had something to write down right then.
    const id = newShiftNoteId(at, stored);
    commit((current) => [
      ...current,
      {
        id,
        // Stamped at the tap, not at render: on a jaga those are hours apart.
        time: formatShiftTime(at),
        body: '',
        clearedAt: null,
        createdAt: Timestamp.now(),
      },
    ]);
    return id;
  }, [commit, patientId, readOnly, stored]);

  const setBody = useCallback((id: string, body: string) => {
    setDraft((current) => ({ ...current, [id]: body }));
  }, []);

  const flush = useCallback(() => {
    const pending = draftRef.current;
    if (Object.keys(pending).length === 0) return;
    commit((current) =>
      current.map((note) =>
        pending[note.id] === undefined ? note : { ...note, body: pending[note.id]! },
      ),
    );
    setDraft({});
  }, [commit]);

  /**
   * Clearing empties the body and stamps `clearedAt`; the element stays.
   *
   * Same shape as clearing an entry. A removed box that vanished from the
   * array would take its timestamp with it, and "something was written at
   * 21.40 and withdrawn" is exactly what a trail is for.
   */
  const clear = useCallback(
    (id: string) => {
      setDraft((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      commit((current) =>
        current.map((note) =>
          note.id === id ? { ...note, body: '', clearedAt: Timestamp.now() } : note,
        ),
      );
    },
    [commit],
  );

  return { notes, add, setBody, clear, flush };
}
