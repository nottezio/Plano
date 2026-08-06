/**
 * Typed, fail-fast access to build-time configuration.
 *
 * A missing Firebase key must surface as a clear message on the sign-in
 * screen, not as an opaque `auth/invalid-api-key` three interactions later.
 */
export interface FirebaseEnv {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const KEYS = [
  ['apiKey', 'VITE_FIREBASE_API_KEY'],
  ['authDomain', 'VITE_FIREBASE_AUTH_DOMAIN'],
  ['projectId', 'VITE_FIREBASE_PROJECT_ID'],
  ['storageBucket', 'VITE_FIREBASE_STORAGE_BUCKET'],
  ['messagingSenderId', 'VITE_FIREBASE_MESSAGING_SENDER_ID'],
  ['appId', 'VITE_FIREBASE_APP_ID'],
] as const;

export interface EnvResult {
  config: FirebaseEnv | null;
  missing: string[];
}

export function readFirebaseEnv(): EnvResult {
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  const missing: string[] = [];
  const partial: Record<string, string> = {};

  for (const [field, key] of KEYS) {
    const value = env[key];
    if (!value) missing.push(key);
    else partial[field] = value;
  }

  return missing.length > 0
    ? { config: null, missing }
    : { config: partial as unknown as FirebaseEnv, missing: [] };
}
