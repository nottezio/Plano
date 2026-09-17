import { compareRosters } from './recency';

/**
 * How Konfirmasi Jaga data from two devices is combined. Pure, so it can be
 * tested without Firestore or a browser.
 *
 * WHAT IS SYNCED
 *
 * The PARSED rosters, never the PDFs: a few kilobytes instead of megabytes, no
 * Firebase Storage, and the other device can use them immediately without
 * parsing. Plus the working state: confirmation ticks, tukar jaga, name and
 * religion corrections, DPJP swaps and the sender identity.
 *
 * TWO KINDS OF DATA, TWO RULES
 *
 * A roster is replaced WHOLESALE by the next import, so there is nothing to
 * merge: the later DOCUMENT wins (see `recency.ts`).
 *
 * The working state is many small independent facts (one tick per date and
 * shift, one correction per initials), so it is synced PER KEY. A device
 * writes only the key it changed, and two devices ticking different shifts
 * cannot overwrite each other. Rewriting a whole map from one device's copy is
 * how data was wiped twice before (recurring pattern 1 in the handoff).
 *
 * THE FIRST SYNC
 *
 * A device that already has local data meets the account for the first time.
 * Nothing local is thrown away: keys the account lacks are uploaded, and where
 * both have a key the account wins, since it may hold another device's newer
 * answer. After that first sync the account is the authority, so a deletion
 * made on one device reaches the others.
 */

export type JagaRosterKind = 'roster' | 'dpjp' | 'jarkom' | 'pediatri';
export const JAGA_ROSTER_KINDS: readonly JagaRosterKind[] = ['roster', 'dpjp', 'jarkom', 'pediatri'];

/** Fields of the state document. `sender` is one value; the rest are maps. */
export type JagaStateField = 'sender' | 'names' | 'religion' | 'confirmed' | 'posts' | 'dpjpEdits';
export const JAGA_MAP_FIELDS = ['names', 'religion', 'confirmed', 'posts', 'dpjpEdits'] as const;
export type JagaMapField = (typeof JAGA_MAP_FIELDS)[number];

export type JagaState = Partial<Record<JagaMapField, Record<string, unknown>>> & {
  sender?: unknown;
};

/** One write to the account: a whole field (`key === null`) or one key in a map. */
export interface JagaStateWrite {
  field: JagaStateField;
  key: string | null;
  /** `null` deletes the key. */
  value: unknown;
}

const isMap = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Which copy of a roster survives: the LATER DOCUMENT, by `compareRosters`
 * (dates covered, then the PDF's own date, then import time). Not simply the
 * later import, or a stale file imported on one device would replace a newer
 * one everywhere.
 */
export function pickRoster(
  kind: JagaRosterKind,
  local: unknown,
  remote: unknown,
): 'upload' | 'download' | 'same' {
  const order = compareRosters(kind, local, remote);
  return order > 0 ? 'upload' : order < 0 ? 'download' : 'same';
}

/**
 * The first meeting of a device's state with the account's.
 *
 * Returns the state to keep locally and the writes that give the account
 * what only this device had.
 */
export function firstSyncState(
  local: JagaState,
  remote: JagaState | null,
): { merged: JagaState; uploads: JagaStateWrite[] } {
  const merged: JagaState = {};
  const uploads: JagaStateWrite[] = [];

  const remoteSender = remote?.sender;
  if (remoteSender !== undefined && remoteSender !== null) {
    merged.sender = remoteSender;
  } else if (local.sender !== undefined && local.sender !== null) {
    merged.sender = local.sender;
    uploads.push({ field: 'sender', key: null, value: local.sender });
  }

  for (const field of JAGA_MAP_FIELDS) {
    const mine = isMap(local[field]) ? local[field] : {};
    const theirs = remote && isMap(remote[field]) ? remote[field] : {};
    const combined: Record<string, unknown> = { ...theirs };
    for (const [key, value] of Object.entries(mine)) {
      if (key in theirs) continue;
      combined[key] = value;
      uploads.push({ field, key, value });
    }
    merged[field] = combined;
  }

  return { merged, uploads };
}

/**
 * The account's state after the first sync: it replaces the local copy,
 * field by field, so deletions made elsewhere arrive too. A field the account
 * does not have yet is left as it is locally rather than emptied.
 */
export function followRemoteState(local: JagaState, remote: JagaState): JagaState {
  const next: JagaState = { ...local };
  if (remote.sender !== undefined) next.sender = remote.sender;
  for (const field of JAGA_MAP_FIELDS) {
    const theirs = remote[field];
    if (isMap(theirs)) next[field] = theirs;
  }
  return next;
}

/**
 * A value made safe for Firestore: `undefined` removed (Firestore rejects it),
 * and nothing that is not plain JSON.
 */
export function toStorable<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}
