import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyDeckState } from '@/domain/slides/deckState';
import { SlidesStorageError, _resetSlidesDb, listImages, loadDeck, putImage, saveDeck, slideUsage, type StoredImage } from './slidesLocal';

const image: StoredImage = {
  imageId: 'i1', patientId: 'p1', blob: new Blob([new Uint8Array(10)]), widthPx: 4, heightPx: 3,
  kind: 'ekg', date: '2026-11-12', place: 'PJT Lt. 4', caption: 'EKG PJT Lt. 4 12-11-2026',
};

/** A stand-in IndexedDB whose open succeeds and whose writes fail with `errorName`. */
function failingWrites(errorName: string): IDBFactory {
  const store = {
    put: () => {
      const req: Record<string, unknown> = { error: new DOMException('full', errorName) };
      queueMicrotask(() => (req.onerror as (() => void) | undefined)?.());
      return req;
    },
  };
  const db = {
    objectStoreNames: { contains: () => true },
    transaction: () => ({ objectStore: () => store }),
  };
  return {
    open: () => {
      const req: Record<string, unknown> = { result: db };
      queueMicrotask(() => (req.onsuccess as (() => void) | undefined)?.());
      return req;
    },
  } as unknown as IDBFactory;
}

describe('slidesLocal', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    _resetSlidesDb();
  });

  it('without IndexedDB: reads are empty, writes reject with SlidesStorageError', async () => {
    vi.stubGlobal('indexedDB', undefined);
    expect(await loadDeck('p1')).toBeNull();
    expect(await listImages('p1')).toEqual([]);
    expect(await slideUsage('p1')).toBeNull();
    await expect(saveDeck(emptyDeckState('p1'))).rejects.toBeInstanceOf(SlidesStorageError);
    await expect(putImage(image)).rejects.toBeInstanceOf(SlidesStorageError);
  });

  it('a write whose request succeeds but whose transaction aborts at commit (quota) still rejects', async () => {
    const tx: Record<string, unknown> = { error: new DOMException('full', 'QuotaExceededError') };
    const store = {
      put: () => {
        const req: Record<string, unknown> = {};
        queueMicrotask(() => {
          (req.onsuccess as (() => void) | undefined)?.();
          queueMicrotask(() => (tx.onabort as (() => void) | undefined)?.());
        });
        return req;
      },
    };
    tx.objectStore = () => store;
    const db = { objectStoreNames: { contains: () => true }, transaction: () => tx };
    vi.stubGlobal('indexedDB', {
      open: () => {
        const req: Record<string, unknown> = { result: db };
        queueMicrotask(() => (req.onsuccess as (() => void) | undefined)?.());
        return req;
      },
    });
    await expect(putImage(image)).rejects.toBeInstanceOf(SlidesStorageError);
  });

  it('a quota error on putImage becomes SlidesStorageError', async () => {
    vi.stubGlobal('indexedDB', failingWrites('QuotaExceededError'));
    await expect(putImage(image)).rejects.toBeInstanceOf(SlidesStorageError);
  });
});
