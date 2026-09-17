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
 * and the counts each app reports about itself. Not `users/{uid}`, which also
 * holds Catatan notes. Firestore rules cannot hide one field of a document, so
 * the only way to keep those notes out of the admin's browser is to never
 * grant the read.
 *
 * WHERE THE SECURITY IS
 *
 * In the rules, on Google's servers. Everything in this file only decides
 * what the SCREEN shows. A client that ignores it gets denied by the server.
 */

export const ADMIN_UID = 'Wh7oXHHQfadqM8UWQubBi2iyj0i2';

export const isAdmin = (uid: string | null | undefined): boolean => uid === ADMIN_UID;

export type AccessStatus = 'pending' | 'approved' | 'revoked';

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
  'stats',
] as const;

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
export type AccessDecision = 'allowed' | 'pending' | 'revoked' | 'unknown';

export function decideAccess(input: {
  uid: string;
  /** `null` while the switch has not been read yet. */
  enforce: boolean | null;
  /** `undefined` while not read yet; `null` when read and the document does not exist. */
  status: AccessStatus | null | undefined;
}): AccessDecision {
  if (isAdmin(input.uid)) return 'allowed';
  if (input.enforce === null) return 'unknown';
  if (!input.enforce) return 'allowed';
  if (input.status === undefined) return 'unknown';
  if (input.status === 'approved') return 'allowed';
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
