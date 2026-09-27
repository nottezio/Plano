import { deleteField, setDoc } from 'firebase/firestore';

import { userDoc } from '../paths';
import { trackWrite } from '../syncStatus';
import type { MrConfig, MrDay } from '@/domain/mr/morningReport';

/**
 * Morning Report settings and drafts, on the profile document.
 *
 * On the profile rather than a new collection because the profile is already
 * subscribed on every device and its rules already allow the owner to write
 * any field: no rules deploy is needed for this feature.
 *
 * Every write names ONE leaf (`setDoc` + `merge`, which merges maps key by
 * key and replaces arrays and strings whole). A pasted list for Sabtu Malam
 * on the phone and a status ticked on the PC touch different leaves and
 * cannot overwrite each other.
 */

function write(uid: string, data: Record<string, unknown>): void {
  void trackWrite(setDoc(userDoc(uid), data, { merge: true })).catch((error: unknown) =>
    console.error('[mr] write rejected', error),
  );
}

export function setMrConfigField<K extends keyof MrConfig>(
  uid: string,
  field: K,
  value: MrConfig[K],
): void {
  write(uid, { morningReport: { [field]: value } });
}

export function setMrWeekdayPengampu(uid: string, weekday: string, names: string[]): void {
  write(uid, { morningReport: { pengampu: { [weekday]: names } } });
}

export function setMrDayField<K extends Exclude<keyof MrDay, 'patients'>>(
  uid: string,
  date: string,
  field: K,
  value: MrDay[K] | null,
): void {
  write(uid, { mrDays: { [date]: { [field]: value === null ? deleteField() : value } } });
}

export function setMrPatients(uid: string, date: string, shiftKey: string, text: string): void {
  write(uid, { mrDays: { [date]: { patients: { [shiftKey]: text } } } });
}

export function dropMrDays(uid: string, dates: readonly string[]): void {
  if (dates.length === 0) return;
  write(uid, { mrDays: Object.fromEntries(dates.map((date) => [date, deleteField()])) });
}
