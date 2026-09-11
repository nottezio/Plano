import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  indexedDBLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

import { readFirebaseEnv } from './env';

/**
 * SPEC 4 / 17 — the offline story in one file.
 *
 * `persistentLocalCache` + `persistentMultipleTabManager` is what makes every
 * read and write succeed with no signal: Firestore keeps an IndexedDB-backed
 * mutation queue that survives a reload, a crash, and a week in a pocket.
 *
 * Two things are deliberate here:
 *
 *  1. `initializeFirestore(...)` rather than `getFirestore()`. Cache settings
 *     can only be supplied at initialisation; calling getFirestore() first
 *     locks in the memory cache and silently disables offline writes. That
 *     failure is invisible until the ward wifi drops.
 *
 *  2. Initialisation is lazy and returns a result object instead of throwing
 *     at module scope. A misconfigured build must render a readable screen,
 *     not a white page.
 */

export interface FirebaseServices {
  /**
   * Resolves once the credential store is settled. Await before subscribing to
   * auth state; see the comment at the call site for what happens otherwise.
   */
  persistenceReady: Promise<void>;
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

export type FirebaseInit =
  | { ok: true; services: FirebaseServices }
  | { ok: false; missing: string[] };

let cached: FirebaseInit | null = null;

export function initFirebase(): FirebaseInit {
  if (cached) return cached;

  const { config, missing } = readFirebaseEnv();
  if (!config) {
    cached = { ok: false, missing };
    return cached;
  }

  const app = initializeApp(config);

  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
    // The ward's wifi drops rather than fails cleanly; long-polling detection
    // avoids the 30 s stall that streaming gets stuck in behind captive portals.
    experimentalAutoDetectLongPolling: true,
  });

  const auth = getAuth(app);

  /**
   * Persistence, resolved BEFORE anyone subscribes to auth state.
   *
   * This used to be fire-and-forget (`void setPersistence(...)`) while
   * `initSession` subscribed to `onAuthStateChanged` on the next line. That is
   * a race with a real losing side: `setPersistence` swaps the store the SDK
   * reads credentials from, and any auth state emitted while the swap is in
   * flight describes a store that is being replaced. The listener cannot tell
   * that from a genuine sign-out — it receives `null` either way.
   *
   * IndexedDB FIRST, localStorage only as the fallback. The previous order was
   * localStorage alone, which is the weaker store for this in three ways: it is
   * the first thing a browser evicts under pressure, it is what "clear browsing
   * data" and cleanup extensions target, and the SDK watches it for cross-tab
   * changes by POLLING — so a read that comes back empty for a moment, with
   * several Plano tabs open, looks exactly like another tab having signed out.
   * IndexedDB is what the SDK itself prefers when left alone.
   *
   * Never swallowed: without persistence the user is signed out on every cold
   * boot, which reads as data loss even though nothing was lost.
   */
  const persistenceReady = setPersistence(auth, indexedDBLocalPersistence)
    .catch((error: unknown) => {
      // Private-mode Safari and a few locked-down Windows profiles refuse
      // IndexedDB outright. localStorage is worse for this, but worse is not
      // the same as unusable, and the alternative is a sign-in on every boot.
      console.warn('[auth] IndexedDB persistence unavailable, falling back', error);
      return setPersistence(auth, browserLocalPersistence);
    })
    .catch((error: unknown) => {
      console.error('[auth] could not set local persistence', error);
    });

  cached = { ok: true, services: { app, auth, db, persistenceReady } };
  return cached;
}

/**
 * Accessor for code that runs only behind the AuthGate, where a configured
 * Firebase is an invariant rather than a possibility.
 */
export function services(): FirebaseServices {
  const init = initFirebase();
  if (!init.ok) {
    throw new Error(
      `[firebase] not configured — missing ${init.missing.join(', ')}`,
    );
  }
  return init.services;
}

export const db = (): Firestore => services().db;
export const auth = (): Auth => services().auth;
