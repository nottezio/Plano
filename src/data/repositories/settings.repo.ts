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

/**
 * Restore every setting to its seeded default.
 *
 * Replaces `settings` WHOLESALE with `setDoc(..., { merge: true })` at the top
 * level, so a field removed from the defaults since this profile was written
 * does not survive as a leftover. `updateSettings` patches by dotted path,
 * which is right for editing one preference and wrong here — a reset that left
 * unknown keys behind is not a reset.
 *
 * What it deliberately does NOT touch:
 *
 *  - `notes` and `scratchNote` — Catatan. Written by hand, owned by nobody
 *    else, and not settings at all. They live beside `settings` on the profile
 *    rather than inside it, so replacing `settings` leaves them alone by
 *    construction rather than by remembering to exclude them.
 *  - Patients and their entries, active or archived. Those are in a different
 *    collection entirely and no settings write can reach them.
 *
 * `checklists` IS reset, because the saved checklists are seeded from
 * `SEED_CHECKLISTS` and are a setting in everything but storage location —
 * that is the one place where "where it is stored" and "what it is" disagree,
 * so it has to be named explicitly here.
 */
export function resetSettings(uid: string): Promise<void> {
  return trackWrite(
    setDoc(
      userDoc(uid),
      {
        settings: defaultUserSettings(),
        /**
         * Emptied, not re-seeded.
         *
         * `PatientTodos` merges `SEED_CHECKLISTS` in at read time for any seed
         * id that is not already saved, so clearing the saved list is what
         * brings the seeds back — writing them in here would store a second
         * copy that then shadows future seed updates, which is the exact
         * problem "Perbarui ke versi terbaru" exists to undo.
         */
        checklists: [],
      },
      { merge: true },
    ),
  );
}
