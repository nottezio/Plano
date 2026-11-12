import type { DeckState, ImageKind } from '@/domain/slides/deckState';
import type { ClinicalDate } from '@/domain/types';

/**
 * Slide MZ's storage: this device only (owner, 2026-11-12: "don't sync yet").
 *
 * Its own database, apart from `visite-localbase`, so nothing here can ever
 * touch the merge bases that protect note text. Raw IndexedDB for the same
 * reason as `localBase.ts`: four operations, and the failure modes (private
 * mode, blocked upgrade, a full disk on a 7 MB import) need explicit handling.
 *
 * Firestore cost: none. Nothing here reads or writes the server.
 *
 * Reads never throw: no storage means "no deck yet", and the editor still
 * exports from the notes. Writes reject with `SlidesStorageError`, which the
 * editor turns into one notice instead of losing work silently.
 */

const DB_NAME = 'visite-slides';
const DB_VERSION = 1;
const STORE_DECKS = 'decks';
const STORE_IMAGES = 'images';

export interface StoredImage {
  imageId: string;
  patientId: string;
  blob: Blob;
  widthPx: number;
  heightPx: number;
  kind: ImageKind;
  date: ClinicalDate;
  place: string;
  caption: string;
}

export class SlidesStorageError extends Error {
  constructor(cause?: unknown) {
    super('Gambar tidak bisa disimpan di perangkat ini.');
    this.name = 'SlidesStorageError';
    if (cause !== undefined) this.cause = cause;
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

/** Tests only: forget the cached connection. */
export function _resetSlidesDb(): void {
  dbPromise = null;
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined' || !indexedDB) {
      reject(new SlidesStorageError());
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_DECKS)) database.createObjectStore(STORE_DECKS, { keyPath: 'patientId' });
      if (!database.objectStoreNames.contains(STORE_IMAGES)) {
        const images = database.createObjectStore(STORE_IMAGES, { keyPath: 'imageId' });
        images.createIndex('patientId', 'patientId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new SlidesStorageError(request.error));
    request.onblocked = () => reject(new SlidesStorageError(new Error('upgrade blocked by another tab')));
  });
  // A failed open must not poison every later call.
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function run<T>(storeName: string, mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const tx = database.transaction(storeName, mode);
        const request = work(tx.objectStore(storeName));
        // A write is only safe once the transaction COMMITS: a full disk aborts it after the request succeeded.
        if (mode === 'readwrite') tx.oncomplete = () => resolve(request.result);
        else request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new SlidesStorageError(request.error));
        tx.onabort = () => reject(new SlidesStorageError(tx.error));
      }),
  );
}

async function quietly<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch {
    return fallback;
  }
}

async function write(work: () => Promise<unknown>): Promise<void> {
  try {
    await work();
  } catch (error) {
    throw error instanceof SlidesStorageError ? error : new SlidesStorageError(error);
  }
}

export function loadDeck(patientId: string): Promise<DeckState | null> {
  return quietly(async () => (await run<DeckState | undefined>(STORE_DECKS, 'readonly', (s) => s.get(patientId))) ?? null, null);
}

export function saveDeck(state: DeckState): Promise<void> {
  return write(() => run(STORE_DECKS, 'readwrite', (s) => s.put(state)));
}

export function listImages(patientId: string): Promise<StoredImage[]> {
  return quietly(() => run<StoredImage[]>(STORE_IMAGES, 'readonly', (s) => s.index('patientId').getAll(patientId)), []);
}

export function putImage(image: StoredImage): Promise<void> {
  return write(() => run(STORE_IMAGES, 'readwrite', (s) => s.put(image)));
}

export function deleteImage(imageId: string): Promise<void> {
  return write(() => run(STORE_IMAGES, 'readwrite', (s) => s.delete(imageId)));
}

/** Null when this device holds nothing for the patient. */
export async function slideUsage(patientId: string): Promise<{ images: number; bytes: number } | null> {
  const [deck, images] = await Promise.all([loadDeck(patientId), listImages(patientId)]);
  if (!deck && images.length === 0) return null;
  return { images: images.length, bytes: images.reduce((sum, image) => sum + image.blob.size, 0) };
}

/** The deck and every image of the patient, in one transaction. */
export function deleteSlides(patientId: string): Promise<void> {
  return write(() =>
    openDb().then(
      (database) =>
        new Promise<void>((resolve, reject) => {
          const tx = database.transaction([STORE_DECKS, STORE_IMAGES], 'readwrite');
          tx.objectStore(STORE_DECKS).delete(patientId);
          const cursor = tx.objectStore(STORE_IMAGES).index('patientId').openKeyCursor(IDBKeyRange.only(patientId));
          cursor.onsuccess = () => {
            const at = cursor.result;
            if (!at) return;
            tx.objectStore(STORE_IMAGES).delete(at.primaryKey);
            at.continue();
          };
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(new SlidesStorageError(tx.error));
          tx.onabort = () => reject(new SlidesStorageError(tx.error));
        }),
    ),
  );
}

/** Patients this device holds slides for (the other-device archive check). */
export function patientsWithSlides(): Promise<string[]> {
  return quietly(async () => {
    const database = await openDb();
    const decks = await run<IDBValidKey[]>(STORE_DECKS, 'readonly', (s) => s.getAllKeys());
    // Walk the patientId index uniquely: listing ids must not load every image blob.
    const imagePatients = await new Promise<string[]>((resolve, reject) => {
      const ids: string[] = [];
      const request = database.transaction(STORE_IMAGES, 'readonly').objectStore(STORE_IMAGES).index('patientId').openKeyCursor(null, 'nextunique');
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return resolve(ids);
        ids.push(String(cursor.key));
        cursor.continue();
      };
      request.onerror = () => reject(new SlidesStorageError(request.error));
    });
    return [...new Set([...decks.map(String), ...imagePatients])];
  }, []);
}
