import {
  deleteDoc,
  deleteField,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';

import { sensusInputCol, sensusInputDoc } from '../paths';
import { trackWrite } from '../syncStatus';
import { readDay, type SensusDay } from '@/domain/census/makerStore';
import type { DayPatch } from '@/domain/census/makerSync';

/**
 * Firestore access for Buat Sensus input (12.6). Path:
 * `users/{uid}/sensusInput/{date}`. See `domain/census/makerSync.ts`.
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export interface SensusInputSnapshot {
  days: Record<string, SensusDay>;
  /** Served from the device cache, not yet confirmed by the server. */
  fromCache: boolean;
  /** Holds a write of ours not yet acknowledged. */
  pending: boolean;
}

export function subscribeSensusInput(
  uid: string,
  callback: (snapshot: SensusInputSnapshot) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    sensusInputCol(uid),
    { includeMetadataChanges: true },
    (snapshot) => {
      const days: Record<string, SensusDay> = {};
      for (const entry of snapshot.docs) {
        if (!ISO.test(entry.id)) continue;
        const day = readDay(entry.data());
        if (day) days[entry.id] = day;
      }
      callback({ days, fromCache: snapshot.metadata.fromCache, pending: snapshot.metadata.hasPendingWrites });
    },
    onError,
  );
}

function leaves<T>(map: Record<string, T | null> | undefined): DocumentData | undefined {
  if (!map) return undefined;
  return Object.fromEntries(Object.entries(map).map(([code, value]) => [code, value === null ? deleteField() : value]));
}

/** Merge one day's changed leaves (`dayPatch`). */
export function writeSensusInput(uid: string, date: string, patch: DayPatch): Promise<void> {
  const data: DocumentData = { date, updatedAt: serverTimestamp() };
  if (patch.lists) data.lists = patch.lists;
  const ai = leaves(patch.ai);
  if (ai) data.ai = ai;
  const extra = leaves(patch.extra);
  if (extra) data.extra = extra;
  const checked = leaves(patch.checked);
  if (checked) data.checked = checked;
  return trackWrite(setDoc(sensusInputDoc(uid, date), data, { merge: true }));
}

/** A day emptied here, or past `KEEP_DAYS`. */
export function deleteSensusInput(uid: string, date: string): Promise<void> {
  return trackWrite(deleteDoc(sensusInputDoc(uid, date)));
}
