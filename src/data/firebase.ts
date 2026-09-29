import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';

import { hasSignedInHint } from './authHint';
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

  /**
   * `initializeAuth`, not `getAuth`: the boot must not wait on the network.
   *
   * `getAuth` attaches the popup/redirect resolver, and on a MOBILE browser
   * (not on a desktop one) the SDK then loads Google's sign-in iframe from the
   * auth domain BEFORE it reports the first auth state, even when the user is
   * already signed in and no sign-in is happening. On ward signal that is
   * seconds of "Memuat…" on every cold start, and after every update reload,
   * which is why the phone felt slow and the laptop did not.
   *
   * So the resolver is attached at start-up only when there is no signed-in
   * user to restore (the sign-in screen needs it ready: a popup opened after
   * a network wait is blocked on iOS). Everyone else boots from the local
   * credential store. Sign-in calls pass the resolver explicitly, so they work
   * either way; sign-out reloads the page, so the next boot attaches it.
   *
   * Persistence: IndexedDB first, localStorage as the fallback for profiles
   * that refuse IndexedDB. Set here, at initialisation, so nothing can observe
   * a half-swapped store (the reason `persistenceReady` exists). A credential
   * already stored in either is found and kept.
   */
  const auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    ...(hasSignedInHint() ? {} : { popupRedirectResolver: browserPopupRedirectResolver }),
  });
  const persistenceReady = Promise.resolve();

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
