import { FieldPath, deleteDoc, deleteField, getDocFromServer, serverTimestamp, setDoc, updateDoc, type Timestamp } from 'firebase/firestore';

import { movePrivateDoc } from '../paths';
import { trackWrite } from '../syncStatus';

/**
 * Device-only settings carried from the old address to the new one:
 * `users/{uid}/private/move` (`domain/moveSettings.ts`). Owner only by the
 * rules. One entry per source device, so a phone and a laptop moving the same
 * account do not overwrite each other.
 */

export interface MoveEntry {
  deviceId: string;
  /** "Android", "iPhone", "Windows"… (`describeDevice`). */
  label: string;
  /** Milliseconds; 0 while the server time is not known yet. */
  at: number;
  json: string;
}

/** Resolves once the server has the entry: the old page navigates away next. */
export function writeMoveEntry(uid: string, deviceId: string, label: string, json: string): Promise<void> {
  return trackWrite(
    setDoc(movePrivateDoc(uid), { devices: { [deviceId]: { label, json, at: serverTimestamp() } } }, { merge: true }),
  );
}

/** From the server, not the cache: the entry was written on another origin. */
export async function readMoveEntries(uid: string): Promise<MoveEntry[]> {
  const snapshot = await getDocFromServer(movePrivateDoc(uid));
  const devices = snapshot.data()?.devices;
  if (!devices || typeof devices !== 'object') return [];
  const entries: MoveEntry[] = [];
  for (const [deviceId, raw] of Object.entries(devices as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const { label, json, at } = raw as { label?: unknown; json?: unknown; at?: Timestamp | null };
    if (typeof json !== 'string') continue;
    entries.push({
      deviceId,
      label: typeof label === 'string' ? label : 'Perangkat lain',
      at: at && typeof at.toMillis === 'function' ? at.toMillis() : 0,
      json,
    });
  }
  return entries.sort((a, b) => b.at - a.at);
}

/** Drops the given entries; the whole document when none would remain. */
export function removeMoveEntries(uid: string, deviceIds: string[], remaining: number): Promise<void> {
  if (remaining <= 0) return trackWrite(deleteDoc(movePrivateDoc(uid)));
  // FieldPath, not a dotted string: a device id is never parsed as a path.
  const [first, ...rest] = deviceIds;
  if (!first) return Promise.resolve();
  const more = rest.flatMap((id) => [new FieldPath('devices', id), deleteField()]);
  return trackWrite(updateDoc(movePrivateDoc(uid), new FieldPath('devices', first), deleteField(), ...more));
}
