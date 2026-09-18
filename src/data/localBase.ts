import type { ClinicalDate } from '@/domain/types';

/**
 * SPEC 7.2 step 4 — `localBase`.
 *
 * Three-way merge needs a *base*: the last body this device knows the server
 * accepted. Firestore does not expose one — its cache holds the latest known
 * document, which after a remote edit is the *remote* version, not the common
 * ancestor. Merging local against remote with remote as the base degenerates
 * to last-write-wins, i.e. the exact data-loss bug SPEC 7 exists to prevent.
 *
 * So the base is stored separately, written only on write *confirmation*
 * (`!metadata.hasPendingWrites`), and read back on reconnect.
 *
 * Raw IndexedDB rather than a wrapper library: the surface is four operations,
 * and the failure modes (blocked upgrade, private mode) need explicit handling
 * anyway.
 */

const DB_NAME = 'visite-localbase';
const DB_VERSION = 2;
const STORE_BASE = 'mergeBase';
/**
 * Body writes this device has made and not yet seen the server confirm.
 *
 * Added in version 2. Firestore's own queue delivers them, but it delivers
 * them BLIND: a write made offline is sent whenever the device reconnects,
 * hours later, and replaces whatever the note has become since. This store
 * keeps the text and the base it was written against, so a write that did not
 * land can be merged instead of replaying over a newer note.
 */
const STORE_OUTBOX = 'outbox';

export interface MergeBaseRecord {
  /** `${patientId}|${date}` */
  key: string;
  patientId: string;
  date: ClinicalDate;
  body: string;
  /** The `rev` the server had when this base was confirmed. */
  rev: number;
  /**
   * The server's OWN `bodyHash` field at that moment.
   *
   * Kept rather than hashing `body` here, and this is the whole point: a
   * write's compare-and-set must compare field to field. Hashing the body
   * ourselves assumes the stored `bodyHash` describes the stored `body`, and
   * `clearEntry` wrote `body: ''` without touching `bodyHash` — so on a
   * cleared day every later write was refused forever (see CHANGES.md).
   */
  bodyHash?: string;
  /** Local epoch ms — diagnostics only, never used for ordering (SPEC 7.4). */
  at: number;
}

export function baseKey(patientId: string, date: ClinicalDate): string {
  return `${patientId}|${date}`;
}

/**
 * The confirmed bases this session has seen, in memory.
 *
 * IndexedDB is async, and the write path cannot afford to await it: a flush on
 * `pagehide` has one tick before the tab is gone, and awaiting a read there
 * would mean the write is never even handed to Firestore — losing the edit the
 * flush exists to save. So the base is read synchronously from here, and
 * IndexedDB is the copy that survives a reload.
 */
const confirmedBases = new Map<string, string>();
/** The server's `bodyHash` field for the same confirmed snapshot. */
const confirmedHashes = new Map<string, string>();

/** The confirmed base if this session already knows it. Never blocks. */
export function peekMergeBase(patientId: string, date: ClinicalDate): string | undefined {
  return confirmedBases.get(baseKey(patientId, date));
}

/**
 * The hash the SERVER has for that confirmed body, to be sent back as a
 * compare-and-set. `undefined` when the entry has none, which is a day this
 * device cannot check and must not block: the write then goes without one.
 */
export function peekMergeHash(patientId: string, date: ClinicalDate): string | undefined {
  return confirmedHashes.get(baseKey(patientId, date));
}

/**
 * The last body this device SENT for a day, confirmed or not.
 *
 * Separate from the confirmed base, and used for a different question.
 *
 *   - What should the server hold when this write arrives?  The last thing we
 *     sent. Firestore preserves write order per document, so a second write
 *     made before the first was acknowledged will find the first already
 *     applied. Comparing it against the older CONFIRMED body instead would
 *     have the rules refuse the user's own newer text on a slow connection.
 *   - What was this text written against, for a merge?  The confirmed body.
 *     Never a body that was only sent: if that one turns out to have been
 *     refused, treating it as the common ancestor would silently drop every
 *     change it carried.
 */
const sentBodies = new Map<string, string>();

export function peekSentBody(patientId: string, date: ClinicalDate): string | undefined {
  return sentBodies.get(baseKey(patientId, date));
}

export function noteSentBody(patientId: string, date: ClinicalDate, body: string): void {
  sentBodies.set(baseKey(patientId, date), body);
}

/** After a refusal, the next write compares against the confirmed body again. */
export function forgetSentBody(patientId: string, date: ClinicalDate): void {
  sentBodies.delete(baseKey(patientId, date));
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_BASE)) {
        const store = database.createObjectStore(STORE_BASE, { keyPath: 'key' });
        store.createIndex('patientId', 'patientId', { unique: false });
      }
      // Version 2. Created alongside, never migrating the base store: an
      // upgrade that rewrites bodies is an upgrade that can lose them.
      if (!database.objectStoreNames.contains(STORE_OUTBOX)) {
        database.createObjectStore(STORE_OUTBOX, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexedDB open failed'));
    request.onblocked = () =>
      reject(new Error('[localBase] upgrade blocked by another open tab'));
  });

  // A failed open must not poison every later call with the same rejection.
  dbPromise.catch(() => {
    dbPromise = null;
  });

  return dbPromise;
}

function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
  storeName: string = STORE_BASE,
): Promise<T> {
  return openDb().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const tx = database.transaction(storeName, mode);
        const request = work(tx.objectStore(storeName));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('indexedDB request failed'));
        tx.onabort = () => reject(tx.error ?? new Error('indexedDB transaction aborted'));
      }),
  );
}

export async function getMergeBase(
  patientId: string,
  date: ClinicalDate,
): Promise<MergeBaseRecord | null> {
  try {
    const record = await run<MergeBaseRecord | undefined>('readonly', (store) =>
      store.get(baseKey(patientId, date)) as IDBRequest<MergeBaseRecord | undefined>,
    );
    if (record) {
      confirmedBases.set(record.key, record.body);
      if (record.bodyHash !== undefined) confirmedHashes.set(record.key, record.bodyHash);
    }
    return record ?? null;
  } catch (error) {
    // No base means the merge falls back to "treat remote as authoritative and
    // raise a conflict" — degraded, but never silently lossy. Loud on purpose.
    console.error('[localBase] read failed', error);
    return null;
  }
}

export async function putMergeBase(record: Omit<MergeBaseRecord, 'key' | 'at'>): Promise<void> {
  const full: MergeBaseRecord = {
    ...record,
    key: baseKey(record.patientId, record.date),
    at: Date.now(),
  };
  confirmedBases.set(full.key, full.body);
  if (full.bodyHash === undefined) confirmedHashes.delete(full.key);
  else confirmedHashes.set(full.key, full.bodyHash);
  // Confirmed: there is nothing in flight to compare against any more.
  if (sentBodies.get(full.key) === full.body) sentBodies.delete(full.key);
  try {
    await run('readwrite', (store) => store.put(full) as IDBRequest<IDBValidKey>);
  } catch (error) {
    console.error('[localBase] write failed', error);
  }
}

export async function deleteMergeBase(
  patientId: string,
  date: ClinicalDate,
): Promise<void> {
  confirmedBases.delete(baseKey(patientId, date));
  confirmedHashes.delete(baseKey(patientId, date));
  try {
    await run('readwrite', (store) => store.delete(baseKey(patientId, date)) as IDBRequest<undefined>);
  } catch (error) {
    console.error('[localBase] delete failed', error);
  }
}

/**
 * SPEC F1 — sign-out clears the local cache and localBase. Leaving one
 * account's note bodies in IndexedDB while another account signs in on the
 * same device is a privacy defect, not a caching detail.
 */
export async function clearLocalBase(): Promise<void> {
  confirmedBases.clear();
  confirmedHashes.clear();
  sentBodies.clear();
  try {
    await run('readwrite', (store) => store.clear() as IDBRequest<undefined>);
    await run('readwrite', (store) => store.clear() as IDBRequest<undefined>, STORE_OUTBOX);
  } catch (error) {
    console.error('[localBase] clear failed', error);
  }
}

/* ------------------------------------------------------------------------ */
/* Outbox — unconfirmed body writes.                                        */
/* ------------------------------------------------------------------------ */

export interface OutboxRecord {
  /** `${patientId}|${date}`: only the newest unconfirmed body per day matters. */
  key: string;
  patientId: string;
  date: ClinicalDate;
  /** The text this device wrote. */
  body: string;
  /** The last CONFIRMED server body when it was written — the merge base. */
  base: string;
  /** Local epoch ms, for showing the user how old an unmerged version is. */
  at: number;
}

export async function putOutbox(record: Omit<OutboxRecord, 'key'>): Promise<void> {
  const full: OutboxRecord = { ...record, key: baseKey(record.patientId, record.date) };
  try {
    await run('readwrite', (store) => store.put(full) as IDBRequest<IDBValidKey>, STORE_OUTBOX);
  } catch (error) {
    // The write still goes to Firestore; only the safety net is missing.
    console.error('[outbox] write failed', error);
  }
}

/**
 * Clear the record for a day, but only if it still describes `body`.
 *
 * The check matters: between sending a write and its confirmation the user may
 * have typed again, and that newer text is what the outbox must keep.
 */
export async function clearOutbox(
  patientId: string,
  date: ClinicalDate,
  body: string,
): Promise<void> {
  try {
    const key = baseKey(patientId, date);
    const record = await run<OutboxRecord | undefined>(
      'readonly',
      (store) => store.get(key) as IDBRequest<OutboxRecord | undefined>,
      STORE_OUTBOX,
    );
    if (!record || record.body !== body) return;
    await run('readwrite', (store) => store.delete(key) as IDBRequest<undefined>, STORE_OUTBOX);
  } catch (error) {
    console.error('[outbox] clear failed', error);
  }
}

export async function listOutbox(): Promise<OutboxRecord[]> {
  try {
    return await run<OutboxRecord[]>(
      'readonly',
      (store) => store.getAll() as IDBRequest<OutboxRecord[]>,
      STORE_OUTBOX,
    );
  } catch (error) {
    console.error('[outbox] list failed', error);
    return [];
  }
}
