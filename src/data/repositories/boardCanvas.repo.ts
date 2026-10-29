import { FieldPath, deleteField, updateDoc } from 'firebase/firestore';

import { userDoc } from '../paths';
import { trackWrite } from '../syncStatus';
import type { CardLayout, SharedCanvas } from '@/domain/board/canvasLayout';

/**
 * Mirror the canvas layout to the account, for the phone's read-only canvas.
 *
 * `updateDoc` with the whole field, not a merge: a merge would keep layout
 * entries (and `hMaxWithNote` flags) that the laptop has since removed. The
 * profile document always exists by the time a board can be arranged.
 */
export function saveSharedCanvas(uid: string, shared: SharedCanvas): Promise<void> {
  return trackWrite(updateDoc(userDoc(uid), { boardCanvas: shared }));
}

/** Canvas width a mirror gets when the phone is the first to write one (no laptop has arranged a canvas yet). */
const DEFAULT_MIRROR_WIDTH = 1180;

/**
 * Edit single layout entries of the mirrored canvas, leaving every other one
 * as the laptop wrote it: the phone changes shelves, not positions. An entry
 * of `null` is removed. `width` is the mirror's own, or null when none exists
 * yet (a mirror without one is not read, see `parseSharedCanvas`).
 */
export function patchSharedCanvas(
  uid: string,
  patch: Readonly<Record<string, CardLayout | null>>,
  width: number | null,
): Promise<void> {
  const edits = Object.entries(patch);
  if (edits.length === 0) return Promise.resolve();
  const fields: unknown[] = [];
  for (const [id, layout] of edits) fields.push(new FieldPath('boardCanvas', 'layouts', id), layout ?? deleteField());
  fields.push(new FieldPath('boardCanvas', 'at'), Date.now());
  if (width === null) fields.push(new FieldPath('boardCanvas', 'width'), DEFAULT_MIRROR_WIDTH);
  const [first, value, ...rest] = fields as [FieldPath, unknown, ...unknown[]];
  return trackWrite(updateDoc(userDoc(uid), first, value, ...rest));
}

/** The phone's block grid (cells and column count). Its shelves are the canvas's: see `domain/board/shelfSync`. */
export function savePhoneGrid(
  uid: string,
  grid: { cells: Record<string, { c: number; r: number }>; columns: number; at: number },
): Promise<void> {
  // Field by field, so the legacy `shelves` list (see `dropLegacyPhoneShelves`) is not wiped by a drag.
  return trackWrite(
    updateDoc(userDoc(uid), 'boardPhoneGrid.cells', grid.cells, 'boardPhoneGrid.columns', grid.columns, 'boardPhoneGrid.at', grid.at),
  );
}

/** The phone's own shelf list, once it has been moved into the canvas's. */
export function dropLegacyPhoneShelves(uid: string): Promise<void> {
  return trackWrite(updateDoc(userDoc(uid), 'boardPhoneGrid.shelves', deleteField()));
}
