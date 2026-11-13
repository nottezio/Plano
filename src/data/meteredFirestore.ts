/**
 * Firestore's server reads, counted.
 *
 * Repositories import these instead of the SDK's own `onSnapshot`, `getDoc`,
 * `getDocs`, `getDocFromServer`, `getDocsFromServer` and
 * `getCountFromServer`. Each behaves exactly like the original and, as a side
 * effect, adds the documents it is estimated to bill to `lib/usageMeter`. The
 * source label is the collection shape of the reference (`patients`,
 * `patients/entries`, `floors/days`…), which is what the admin needs to see
 * which part of the app is expensive.
 *
 * Cache-only reads (`getDocsFromCache`…) cost nothing and stay unmetered.
 * See `domain/usage.ts` for the counting model and its known error.
 */
import {
  getCountFromServer as sdkGetCountFromServer,
  getDoc as sdkGetDoc,
  getDocFromServer as sdkGetDocFromServer,
  getDocs as sdkGetDocs,
  getDocsFromServer as sdkGetDocsFromServer,
  onSnapshot as sdkOnSnapshot,
  type DocumentData,
  type DocumentReference,
  type Query,
} from 'firebase/firestore';

import { readsFor, type SnapshotFacts } from '@/domain/usage';
import { recordReads } from '@/lib/usageMeter';

/** `patients/abc/entries/2026-11-13` → `patients/entries`: the collections, never the ids. */
const shape = (path: string): string =>
  path
    .split('/')
    .filter((_, index) => index % 2 === 0)
    .join('/');

function labelOf(ref: unknown): string {
  const candidate = ref as {
    path?: unknown;
    _query?: { path?: { canonicalString?: () => string }; collectionGroup?: string | null };
  };
  if (typeof candidate.path === 'string') return shape(candidate.path);
  const internal = candidate._query;
  if (internal?.collectionGroup) return `*/${internal.collectionGroup}`;
  const path = internal?.path?.canonicalString?.();
  return path ? shape(path) : 'query';
}

function factsOf(snapshot: unknown): SnapshotFacts {
  const value = snapshot as {
    metadata: { fromCache: boolean };
    size?: number;
    docChanges?: () => unknown[];
  };
  const isQuery = typeof value.size === 'number';
  return {
    fromCache: value.metadata.fromCache,
    isQuery,
    size: value.size ?? 1,
    changes: isQuery ? (value.docChanges?.().length ?? 0) : 1,
  };
}

type Loose = (...args: unknown[]) => unknown;

/** Wrap the callback of an `onSnapshot` call, wherever the overloads put it. */
function meterListener(label: string, rest: unknown[]): unknown[] {
  let first = true;
  const count = (snapshot: unknown): void => {
    const facts = factsOf(snapshot);
    recordReads(label, readsFor(facts, first));
    if (!facts.fromCache) first = false;
  };
  const args = [...rest];
  const at = args.findIndex(
    (arg) => typeof arg === 'function' || (typeof arg === 'object' && arg !== null && 'next' in arg),
  );
  const target = args[at];
  if (typeof target === 'function') {
    args[at] = (snapshot: unknown): unknown => {
      count(snapshot);
      return (target as Loose)(snapshot);
    };
  } else if (target && typeof target === 'object') {
    const observer = target as { next: Loose };
    args[at] = {
      ...observer,
      next: (snapshot: unknown): unknown => {
        count(snapshot);
        return observer.next(snapshot);
      },
    };
  }
  return args;
}

export const onSnapshot = ((ref: unknown, ...rest: unknown[]) =>
  (sdkOnSnapshot as unknown as Loose)(ref, ...meterListener(labelOf(ref), rest))) as unknown as typeof sdkOnSnapshot;

export const getDocs = (async (query: Query<DocumentData>) => {
  const snapshot = await sdkGetDocs(query);
  recordReads(labelOf(query), readsFor({ ...factsOf(snapshot), changes: snapshot.size }, true));
  return snapshot;
}) as unknown as typeof sdkGetDocs;

export const getDocsFromServer = (async (query: Query<DocumentData>) => {
  const snapshot = await sdkGetDocsFromServer(query);
  recordReads(labelOf(query), Math.max(1, snapshot.size));
  return snapshot;
}) as unknown as typeof sdkGetDocsFromServer;

export const getDoc = (async (ref: DocumentReference<DocumentData>) => {
  const snapshot = await sdkGetDoc(ref);
  recordReads(labelOf(ref), readsFor(factsOf(snapshot), true));
  return snapshot;
}) as unknown as typeof sdkGetDoc;

export const getDocFromServer = (async (ref: DocumentReference<DocumentData>) => {
  const snapshot = await sdkGetDocFromServer(ref);
  recordReads(labelOf(ref), 1);
  return snapshot;
}) as unknown as typeof sdkGetDocFromServer;

/** An aggregate bills one read per 1,000 index entries counted, at least one: counted as one. */
export const getCountFromServer = (async (query: Query<DocumentData>) => {
  const result = await sdkGetCountFromServer(query);
  recordReads(labelOf(query), 1);
  return result;
}) as unknown as typeof sdkGetCountFromServer;
