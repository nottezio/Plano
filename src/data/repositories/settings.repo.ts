import {
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';

import { userDoc } from '../paths';
import { trackWrite } from '../syncStatus';
import { defaultUserSettings } from '@/domain/defaults';
import {
  SCHEMA_VERSION,
  type SavedChecklist,
  type ScratchNote,
  type UserProfile,
  type UserSettings,
} from '@/domain/types';

/**
 * The profile document carries settings. It is created on first sign-in with
 * the seed defaults; `{ merge: true }` means a second device signing in never
 * overwrites settings the first device already customised.
 */
export function ensureProfile(user: User): Promise<void> {
  const record: DocumentData = {
    uid: user.uid,
    displayName: user.displayName ?? '',
    email: user.email ?? '',
    schemaVersion: SCHEMA_VERSION,
  };
  return trackWrite(setDoc(userDoc(user.uid), record, { merge: true }));
}

/**
 * Seeds settings ONLY when there are none. It has to read before it writes.
 *
 * The comment above this function used to say it seeded only when the field was
 * absent, and it did not: `setDoc` with `merge: true` **deep-merges maps**, so
 * it wrote every default key back on top of the stored ones. It runs on every
 * sign-in, so every page refresh silently reset every setting that differed
 * from its default.
 *
 * The settings were saving correctly the whole time — the export proves it —
 * and were being overwritten a moment later on the way back in.
 *
 * A read costs one round trip on sign-in and is the only way to tell "no
 * settings yet" from "settings that happen to look like defaults".
 */
export async function seedSettingsIfMissing(uid: string): Promise<void> {
  const snapshot = await getDoc(userDoc(uid));
  if (snapshot.exists() && snapshot.data()?.['settings']) return;

  await trackWrite(
    setDoc(
      userDoc(uid),
      { settings: defaultUserSettings(), createdAt: serverTimestamp() },
      { merge: true },
    ),
  );
}

export function subscribeProfile(
  uid: string,
  callback: (profile: UserProfile | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    userDoc(uid),
    (snapshot) => callback(snapshot.exists() ? (snapshot.data() as UserProfile) : null),
    onError,
  );
}

/**
 * Settings are patched by dotted path so that two devices editing different
 * settings (theme here, checklist order there) do not overwrite each other.
 */
/**
 * Settings are written with `setDoc(..., { merge: true })`, not `updateDoc`.
 *
 * `updateDoc` with dotted paths — `settings.theme` — **fails outright if the
 * document does not exist**, and the rejection was logged rather than surfaced,
 * so settings silently did not save. Exactly the failure `setEntryLocked` had:
 * a write that assumes a document someone else was supposed to create.
 *
 * `setDoc` with merge works whether or not the profile exists, and merges
 * nested maps key by key, so patching one setting still leaves the rest alone.
 */
export function updateSettings(uid: string, patch: Partial<UserSettings>): Promise<void> {
  const settings: DocumentData = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) settings[key] = value;
  }
  if (Object.keys(settings).length === 0) return Promise.resolve();

  return trackWrite(setDoc(userDoc(uid), { settings }, { merge: true }));
}

/**
 * The personal scratch note. Merged, so it never disturbs settings alongside it.
 */
export function updateProfileNote(uid: string, scratchNote: string): Promise<void> {
  return trackWrite(setDoc(userDoc(uid), { scratchNote }, { merge: true }));
}

/**
 * The whole tab list, written as one field.
 *
 * Wholesale rather than per-note, because reordering, renaming and deleting all
 * change the array's shape, and a per-index patch would race with them. The
 * list is a handful of short notes; writing it whole costs nothing.
 */
export function updateScratchNotes(uid: string, notes: ScratchNote[]): Promise<void> {
  return trackWrite(setDoc(userDoc(uid), { notes }, { merge: true }));
}

/** The whole checklist collection, written as one field, for the same reason. */
export function updateChecklists(uid: string, checklists: SavedChecklist[]): Promise<void> {
  return trackWrite(setDoc(userDoc(uid), { checklists }, { merge: true }));
}
