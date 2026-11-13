import { beforeEach, describe, expect, it, vi } from 'vitest';

const recorded: [string, number][] = [];

vi.mock('@/lib/usageMeter', () => ({
  recordReads: (label: string, count: number) => {
    if (count > 0) recorded.push([label, count]);
  },
}));

// A tiny fake SDK: onSnapshot hands the test the callback it was given.
let attached: { next: (snapshot: unknown) => void } | undefined;
vi.mock('firebase/firestore', () => ({
  onSnapshot: (_ref: unknown, ...rest: unknown[]) => {
    const target = rest.find(
      (arg) => typeof arg === 'function' || (typeof arg === 'object' && arg !== null && 'next' in arg),
    );
    attached = {
      next: (snapshot) =>
        typeof target === 'function'
          ? (target as (s: unknown) => void)(snapshot)
          : (target as { next: (s: unknown) => void }).next(snapshot),
    };
    return () => undefined;
  },
  getDoc: async () => ({ metadata: { fromCache: false } }),
  getDocFromServer: async () => ({ metadata: { fromCache: false } }),
  getDocs: async () => ({ metadata: { fromCache: false }, size: 3 }),
  getDocsFromServer: async () => ({ metadata: { fromCache: false }, size: 0 }),
  getCountFromServer: async () => ({}),
}));

import { getDoc, getDocs, getDocsFromServer, onSnapshot } from './meteredFirestore';

type Loose = (...args: unknown[]) => unknown;
const listen = onSnapshot as unknown as Loose;

const querySnap = (size: number, changes: number, fromCache = false) => ({
  metadata: { fromCache },
  size,
  docChanges: () => new Array<unknown>(changes).fill(0),
});

const queryRef = { _query: { path: { canonicalString: () => 'patients/abc/entries' } } };
const docRef = { path: 'patients/abc/entries/day' };

beforeEach(() => {
  recorded.length = 0;
  attached = undefined;
});

describe('onSnapshot', () => {
  it('bills the first server snapshot in full, then only the changes', () => {
    listen(queryRef, () => undefined);
    attached?.next(querySnap(40, 40));
    attached?.next(querySnap(40, 2));
    attached?.next(querySnap(40, 0));
    expect(recorded).toEqual([
      ['patients/entries', 40],
      ['patients/entries', 2],
    ]);
  });

  it('counts nothing from the cache, and the next server snapshot is still the first', () => {
    listen(queryRef, () => undefined);
    attached?.next(querySnap(40, 40, true));
    attached?.next(querySnap(40, 40));
    expect(recorded).toEqual([['patients/entries', 40]]);
  });

  it('works through the observer form with options', () => {
    const seen: unknown[] = [];
    listen(docRef, { includeMetadataChanges: true }, { next: (snapshot: unknown) => seen.push(snapshot) });
    attached?.next({ metadata: { fromCache: false } });
    expect(recorded).toEqual([['patients/entries', 1]]);
    expect(seen).toHaveLength(1);
  });

  it('still calls the original callback', () => {
    const seen: unknown[] = [];
    listen(queryRef, (snapshot: unknown) => seen.push(snapshot));
    attached?.next(querySnap(1, 1));
    expect(seen).toHaveLength(1);
  });
});

describe('one-off reads', () => {
  it('bills getDocs by documents returned and getDoc by one', async () => {
    await (getDocs as unknown as (q: unknown) => Promise<unknown>)(queryRef);
    await (getDoc as unknown as (r: unknown) => Promise<unknown>)(docRef);
    expect(recorded).toEqual([
      ['patients/entries', 3],
      ['patients/entries', 1],
    ]);
  });

  it('bills an empty server query as one read', async () => {
    await (getDocsFromServer as unknown as (q: unknown) => Promise<unknown>)(queryRef);
    expect(recorded).toEqual([['patients/entries', 1]]);
  });
});
