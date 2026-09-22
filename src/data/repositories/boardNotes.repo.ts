import { FieldPath, updateDoc } from 'firebase/firestore';
import { nanoid } from 'nanoid';

import { userDoc } from '../paths';
import { trackWrite } from '../syncStatus';
import type { StickyColor } from '@/domain/boardNotes';

/**
 * Sticky-note writes. Each one touches exactly ONE field path under
 * `boardNotes.<id>`, which is what makes two quick edits — or an edit on the
 * phone and a colour change on the PC — unable to overwrite each other.
 *
 * `FieldPath`, not a dotted string: the id is generated here and has no dots,
 * but a path built from segments cannot be misread whatever the id contains.
 */

export function createBoardNote(uid: string, color: StickyColor = 'kuning'): string {
  const id = nanoid(8);
  void trackWrite(
    updateDoc(userDoc(uid), new FieldPath('boardNotes', id), {
      text: '',
      color,
      createdAt: Date.now(),
    }),
  ).catch((error: unknown) => console.error('[sticky] create rejected', error));
  return id;
}

export function setBoardNoteText(uid: string, id: string, text: string): Promise<void> {
  return trackWrite(updateDoc(userDoc(uid), new FieldPath('boardNotes', id, 'text'), text));
}

export function setBoardNoteColor(uid: string, id: string, color: StickyColor): Promise<void> {
  return trackWrite(updateDoc(userDoc(uid), new FieldPath('boardNotes', id, 'color'), color));
}

/** Soft delete: the note leaves the board; its text stays in the profile. */
export function removeBoardNote(uid: string, id: string): Promise<void> {
  return trackWrite(
    updateDoc(userDoc(uid), new FieldPath('boardNotes', id, 'deletedAt'), Date.now()),
  );
}
