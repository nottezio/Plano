import { connectAuthEmulator, GoogleAuthProvider, signInWithCredential, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, type Firestore } from 'firebase/firestore';

import type { FirebaseEnv } from './env';

/**
 * Local preview against the Firebase emulators (`npm run emu` + `npm run dev:emu`).
 *
 * Exists so a browser with no stored login (the Claude preview pane forgets
 * IndexedDB) still reaches a signed-in UI. Never reaches production: the whole
 * branch hangs off `import.meta.env.MODE === 'emulator'`, which only
 * `vite --mode emulator` sets, and it refuses any host but loopback.
 */

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isEmulatorMode(mode: string, hostname: string): boolean {
  return mode === 'emulator' && LOOPBACK.has(hostname);
}

/** A `demo-` project id makes the emulators refuse to touch a real project. */
export const EMULATOR_CONFIG: FirebaseEnv = {
  apiKey: 'demo-api-key',
  authDomain: 'localhost',
  projectId: 'demo-plano',
  storageBucket: 'demo-plano.appspot.com',
  messagingSenderId: '0',
  appId: '1:0:web:demo',
};

export function connectEmulators(auth: Auth, db: Firestore): void {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);

  // The rules and AccessGate accept Google sessions only. The Auth emulator
  // takes a JSON string as the Google id token, so this is a real google.com
  // sign-in as far as both are concerned.
  void auth
    .authStateReady()
    .then(() => {
      if (auth.currentUser) return;
      const idToken = JSON.stringify({
        sub: 'dev-user',
        email: 'dev@example.test',
        email_verified: true,
        name: 'Dev Preview',
      });
      return signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    })
    .catch((error: unknown) => console.error('[emulator] auto sign-in failed', error));
}
