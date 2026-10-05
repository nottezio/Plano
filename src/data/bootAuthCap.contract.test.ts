import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import type * as AuthModule from 'firebase/auth';
import type { Persistence, User } from 'firebase/auth';
import { afterEach, beforeAll, expect, test } from 'vitest';

import { installBootAuthCap } from './bootAuthCap';

/**
 * The SDK contract the start-up cap rests on, checked against the real
 * Firebase Auth rather than assumed:
 *
 *   a stored user whose start-up account check fails as a NETWORK error is
 *   kept, not signed out.
 *
 * If a Firebase upgrade changes that, this test fails, and the cap would be
 * signing people out on slow wifi; it must not ship until it is resolved.
 */

/*
 * The BROWSER build, loaded by path. Under Vitest's Node conditions the
 * package's `exports` map resolves `firebase/auth` to its Node build, which
 * brings its own fetch: the test would pass without ever touching the cap.
 * What ships to the phone and laptop is `dist/esm`, so that is what is tested.
 */
let auth: typeof AuthModule;
beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const firebaseDir = path.dirname(require.resolve('firebase/package.json'));
  const authEntry = require.resolve('@firebase/auth', { paths: [firebaseDir] });
  const authDir = authEntry.slice(0, authEntry.lastIndexOf(`${path.sep}dist${path.sep}`));
  auth = (await import(
    /* @vite-ignore */ pathToFileURL(path.join(authDir, 'dist', 'esm', 'index.js')).href
  )) as typeof AuthModule;
});

const API_KEY = 'test-key';
const STORE: Record<string, unknown> = {};

/** A LOCAL persistence holding one stored user, as IndexedDB would after a past sign-in. */
class StoredUserPersistence {
  static type = 'LOCAL' as const;
  readonly type = 'LOCAL' as const;
  _isAvailable(): Promise<boolean> {
    return Promise.resolve(true);
  }
  _set(key: string, value: unknown): Promise<void> {
    STORE[key] = value;
    return Promise.resolve();
  }
  _get<T>(key: string): Promise<T | null> {
    return Promise.resolve((STORE[key] as T | undefined) ?? null);
  }
  _remove(key: string): Promise<void> {
    delete STORE[key];
    return Promise.resolve();
  }
  _addListener(): void {}
  _removeListener(): void {}
}

function storeUser(appName: string): void {
  STORE[`firebase:authUser:${API_KEY}:${appName}`] = {
    uid: 'resident-1',
    email: 'resident@example.com',
    emailVerified: true,
    isAnonymous: false,
    providerData: [],
    stsTokenManager: {
      refreshToken: 'refresh',
      accessToken: 'expired',
      // Expired: the check must refresh the token first, as after a night off.
      expirationTime: Date.now() - 60_000,
    },
    createdAt: '1',
    lastLoginAt: '1',
    apiKey: API_KEY,
    appName,
  };
}

const realFetch = globalThis.fetch;
let app: FirebaseApp | null = null;

afterEach(async () => {
  globalThis.fetch = realFetch;
  if (app) await deleteApp(app);
  app = null;
  for (const key of Object.keys(STORE)) delete STORE[key];
});

function firstAuthState(appName: string, capMs: number) {
  const requested: string[] = [];
  // Google never answers: the slow-not-dead hospital network.
  globalThis.fetch = ((input: RequestInfo | URL) => {
    requested.push(String(input instanceof Request ? input.url : input));
    return new Promise<Response>(() => undefined);
  }) as typeof fetch;
  const cap = installBootAuthCap(capMs);
  app = initializeApp({ apiKey: API_KEY, authDomain: 'example.firebaseapp.com', projectId: 'p' }, appName);
  const instance = auth.initializeAuth(app, {
    persistence: StoredUserPersistence as unknown as Persistence,
  });
  const started = Date.now();
  const user = new Promise<User | null>((resolve) => {
    const stop = auth.onAuthStateChanged(instance, (next) => {
      stop();
      cap.release();
      resolve(next);
    });
  });
  return { user, started, requested, cap };
}

test('a hung start-up account check keeps the stored user, within the cap', async () => {
  storeUser('contract-kept');
  const { user, started, requested, cap } = firstAuthState('contract-kept', 200);
  const result = await user;
  expect(result?.uid).toBe('resident-1');
  expect(Date.now() - started).toBeLessThan(5000);
  expect(cap.capped()).toBe(true);
  // The SDK really went to the network through the fetch the cap wraps.
  expect(requested.some((url) => url.includes('securetoken.googleapis.com'))).toBe(true);
}, 10_000);

test('with nobody stored, the first state is signed out, and nothing was asked', async () => {
  const { user, requested } = firstAuthState('contract-empty', 200);
  expect(await user).toBeNull();
  expect(requested).toEqual([]);
}, 10_000);

test('control: without the cap the same start-up is still waiting (the 6–17 s "Memuat…")', async () => {
  storeUser('contract-uncapped');
  globalThis.fetch = (() => new Promise<Response>(() => undefined)) as typeof fetch;
  app = initializeApp({ apiKey: API_KEY, authDomain: 'example.firebaseapp.com', projectId: 'p' }, 'contract-uncapped');
  const instance = auth.initializeAuth(app, {
    persistence: StoredUserPersistence as unknown as Persistence,
  });
  let reported = false;
  const stop = auth.onAuthStateChanged(instance, () => {
    reported = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  stop();
  expect(reported).toBe(false);
}, 10_000);
