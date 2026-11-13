/**
 * Who may use Plano.
 *
 * THE MODEL
 *
 * - One admin, fixed by UID. The same UID is written into `firestore.rules`,
 *   and a test checks the two agree. Not stored as data: an admin list held in
 *   a document is one more thing that could be written to.
 * - Everyone else has an `access/{uid}` document, created by their own app at
 *   first sign-in with `status: 'pending'`. The admin approves once, and the
 *   approval stands until the admin revokes it. Revoking sets
 *   `status: 'revoked'` rather than deleting, so the record of who decided and
 *   when survives, and approving again is one tap.
 * - A switch, `config/access.enforce`, turns the check on. Off by default, so
 *   deploying this changes nothing until the admin has approved the existing
 *   accounts and turned it on. No resident is locked out in the gap.
 *
 * WHAT THE ADMIN CAN SEE
 *
 * Only `access/{uid}`: email, name, first and last seen, device, app version,
 * the address it was opened from, and the counts each app reports about itself.
 * Since 13 Nov 2026 also the List Maker floor DOCUMENTS (name, ward, owner,
 * members and roles; read only), never a roster or a sent list.
 *
 * Since 13 Nov 2026 also PATIENTS and their daily NOTES, read only (owner's
 * decision: residents can already open any patient in the hospital system by
 * RM, and the admin needs to support them). Safeguards: the console stamps
 * `lastAdminViewAt` on the account BEFORE it reads and refuses to read if the
 * stamp fails; the account sees that stamp and a plain statement in Akun; the
 * admin has no write on patients; and `users/{uid}` (settings, Catatan notes,
 * the AI key) stays closed to the admin. Not `users/{uid}`, which also
 * holds Catatan notes. Firestore rules cannot hide one field of a document, so
 * the only way to keep those notes out of the admin's browser is to never
 * grant the read.
 *
 * WHERE THE SECURITY IS
 *
 * In the rules, on Google's servers. Everything in this file only decides
 * what the SCREEN shows. A client that ignores it gets denied by the server.
 */

import type { AccessNotice } from './notice';
import type { DeviceUsage } from './usage';

export const ADMIN_UID ='Wh7oXHHQfadqM8UWQubBi2iyj0i2';

export const isAdmin = (uid: string | null | undefined): boolean => uid === ADMIN_UID;

/** The admin's "last opened" stamp is refreshed at most this often per account. */
export const ADMIN_VIEW_STAMP_EVERY_MS = 60 * 60 * 1000;

/**
 * Whether the stamp is recent enough to leave alone. So the time an account
 * sees in Akun is never more than an hour behind the admin's last look, while
 * reopening the same account does not write every time.
 */
export const stampIsFresh = (lastAdminViewAt: Date | null, now: number): boolean =>
  lastAdminViewAt !== null && now - lastAdminViewAt.getTime() < ADMIN_VIEW_STAMP_EVERY_MS;

/** `viewer` (22 Oct 2026): admitted to read List Maker lists only. */
export type AccessStatus = 'pending' | 'approved' | 'viewer' | 'revoked';

/**
 * Fields a user's own app may write to its `access` document. Anything else,
 * `status` above all, is the admin's. Mirrored in `firestore.rules`
 * (`registryKeys()`); a test keeps the two lists identical.
 */
export const REGISTRY_KEYS = [
  'uid',
  'email',
  'displayName',
  'firstSeenAt',
  'lastSeenAt',
  'device',
  'appVersion',
  'host',
  'stats',
  'usage',
] as const;

/** Where Plano moved to (hosting migration, Nov 2026). The admin tab counts who is there. */
export const NEW_HOST = 'tabulaplano.web.app';

/** The `config/access` document, as the app reads it. */
export interface AccessConfig {
  enforce: boolean;
  /** Apps older than this are asked to update. `null` = no minimum. Never blocks use. */
  minVersion: string | null;
  /** A message to every account, from the admin; `null` = none. Expiry is judged on the device. */
  notice: AccessNotice | null;
}

export interface AccessStats {
  /** Patients on this device's copy, archived and trashed included. */
  patients: number;
  /** Daily notes on this device's copy. */
  entries: number;
  /** Approximate size of that copy, in kilobytes. */
  approxKb: number;
}

export interface AccessRecord {
  uid: string;
  email: string;
  displayName: string;
  status: AccessStatus;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  device: string;
  appVersion: string;
  /** The address the app was opened from (`location.host`); '' until a newer app reports it. */
  host: string;
  /** A message for this account only, from the admin. */
  notice: AccessNotice | null;
  /** What each of the account's devices estimates it read and wrote (key = device). */
  usage: Record<string, DeviceUsage>;
  /** When the admin last opened this account's patients (admin-written; the account sees it). */
  lastAdminViewAt: Date | null;
  stats: (AccessStats & { at: Date | null }) | null;
  decidedAt: Date | null;
}

/**
 * What the screen shows for a signed-in user.
 *
 * `unknown` means the answer has not come from the server yet and nothing is
 * cached. It is shown as a wait, never as a refusal: an approved resident on
 * a new phone with no signal must not be told they were rejected.
 */
export type AccessDecision = 'allowed' | 'viewer' | 'pending' | 'revoked' | 'unknown' | 'not-google';

export function decideAccess(input: {
  uid: string;
  /** `null` while the switch has not been read yet. */
  enforce: boolean | null;
  /** `undefined` while not read yet; `null` when read and the document does not exist. */
  status: AccessStatus | null | undefined;
  /**
   * Whether this session was signed in with Google. Plano is Google-only;
   * a session made with a password before that provider was switched off
   * stays valid in Firebase, so it is refused here (and in the rules).
   */
  google?: boolean;
}): AccessDecision {
  if (isAdmin(input.uid)) return 'allowed';
  if (input.google === false) return 'not-google';
  if (input.enforce === null) return 'unknown';
  if (!input.enforce) return 'allowed';
  if (input.status === undefined) return 'unknown';
  if (input.status === 'approved') return 'allowed';
  if (input.status === 'viewer') return 'viewer';
  if (input.status === 'revoked') return 'revoked';
  return 'pending';
}

/**
 * Whether a throttled write is due. The registration refreshes `lastSeenAt`
 * at most hourly and the stats at most every six hours, so a resident moving
 * between screens all shift costs a few writes a day, not hundreds.
 */
export function isDue(lastAt: number | null, now: number, everyMs: number): boolean {
  return lastAt === null || !Number.isFinite(lastAt) || now - lastAt >= everyMs;
}

export const LAST_SEEN_EVERY_MS = 60 * 60 * 1000;
export const STATS_EVERY_MS = 6 * 60 * 60 * 1000;
