import { updateDoc } from 'firebase/firestore';

import { userDoc } from '../paths';
import { trackWrite } from '../syncStatus';
import type { SharedCanvas } from '@/domain/board/canvasLayout';

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

/** The phone's block grid (see `domain/board/phoneGrid`), replaced whole. */
export function savePhoneGrid(
  uid: string,
  grid: { cells: Record<string, { c: number; r: number }>; columns: number; at: number },
): Promise<void> {
  return trackWrite(updateDoc(userDoc(uid), { boardPhoneGrid: grid }));
}
