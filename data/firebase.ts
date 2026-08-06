import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
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
  // Survive a reload and an app restart. Never swallow the failure: without
  // persistence the user is signed out every cold boot, which reads as data
  // loss even though nothing was lost.
  void setPersistence(auth, browserLocalPersistence).catch((error: unknown) => {
    console.error('[auth] could not set local persistence', error);
  });

  cached = { ok: true, services: { app, auth, db } };
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
