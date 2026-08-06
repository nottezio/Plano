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
const DB_VERSION = 1;
const STORE_BASE = 'mergeBase';

export interface MergeBaseRecord {
  /** `${patientId}|${date}` */
  key: string;
  patientId: string;
  date: ClinicalDate;
  body: string;
  /** The `rev` the server had when this base was confirmed. */
  rev: number;
  /** Local epoch ms — diagnostics only, never used for ordering (SPEC 7.4). */
  at: number;
}

export function baseKey(patientId: string, date: ClinicalDate): string {
  return `${patientId}|${date}`;
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
): Promise<T> {
  return openDb().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const tx = database.transaction(STORE_BASE, mode);
        const request = work(tx.objectStore(STORE_BASE));
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
  try {
    await run('readwrite', (store) => store.clear() as IDBRequest<undefined>);
  } catch (error) {
    console.error('[localBase] clear failed', error);
  }
}
