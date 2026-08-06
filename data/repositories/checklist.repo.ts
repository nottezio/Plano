import {
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { getDeviceId } from '../deviceId';
import { checklistDoc } from '../paths';
import { cacheBoardChecklist } from './patients.repo';
import { trackWrite } from '../syncStatus';
import type { ChecklistItemDef, ChecklistTickState, ClinicalDate, DailyChecklist } from '@/domain/types';

/**
 * SPEC 9.2 — the checklist "reset" is architectural, not scheduled.
 *
 * There is no timer, no cron, no midnight job anywhere in this file. The doc
 * id IS the clinical date, so a new day is a new document id and a missing
 * document means every item is unchecked. That is correct across timezones,
 * correct offline, correct on a device that slept for a week, and impossible
 * to double-fire.
 */

export function allUnchecked(items: readonly ChecklistItemDef[]): Record<string, ChecklistTickState> {
  const state: Record<string, ChecklistTickState> = {};
  for (const item of items) state[item.id] = { done: false, at: null, by: null };
  return state;
}

export function subscribeChecklist(
  patientId: string,
  date: ClinicalDate,
  callback: (checklist: DailyChecklist | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    checklistDoc(patientId, date),
    (snapshot) => callback(snapshot.exists() ? (snapshot.data() as DailyChecklist) : null),
    onError,
  );
}

/**
 * Each item is a separate map key (SPEC 7.1), so ticking item 3 on the phone
 * can never clobber item 5 ticked on the iPad — Firestore merges the two
 * mutations field-by-field with no conflict surface at all.
 */
export function setTick(
  patientId: string,
  date: ClinicalDate,
  itemId: string,
  done: boolean,
  /**
   * The caller's already-resolved done map for this day, with `itemId` applied.
   * Passed in rather than re-derived so the board cache is written wholesale
   * and cannot inherit keys from a previous clinical day.
   */
  doneMap: Record<string, boolean>,
  /**
   * Whether `date` is the CURRENT clinical day.
   *
   * The board cache is a single `{date, done}` object, so writing it while the
   * user ticks a *past* day would replace today's cached ticks with that older
   * day's and blank the card's colour on every device. Back-dated ticks
   * therefore update only the authoritative document.
   */
  isCurrentDay: boolean,
): Promise<void> {
  if (isCurrentDay) void cacheBoardChecklist(patientId, date, doneMap);
  return trackWrite(
    setDoc(
      checklistDoc(patientId, date),
      {
        date,
        items: {
          [itemId]: done
            ? { done: true, at: serverTimestamp(), by: getDeviceId() }
            : { done: false, at: null, by: null },
        },
      },
      { merge: true },
    ),
  );
}
