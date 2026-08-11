import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { clearIndexedDbPersistence, terminate } from 'firebase/firestore';
import { create } from 'zustand';

import { initFirebase, services } from '@/data/firebase';
import { clearLocalBase } from '@/data/localBase';
import {
  ensureProfile,
  seedSettingsIfMissing,
  subscribeProfile,
} from '@/data/repositories/settings.repo';
import type { UserProfile, UserSettings } from '@/domain/types';
import { defaultUserSettings } from '@/domain/defaults';
import {
  requestPersistentStorage,
  type StoragePersistence,
} from '@/lib/storagePersistence';

export type SessionStatus =
  | 'loading'
  | 'unconfigured'
  | 'signed-out'
  | 'signed-in';

interface SessionState {
  status: SessionStatus;
  /** Whether the browser has promised not to evict our IndexedDB. */
  storagePersistence: StoragePersistence;
  user: User | null;
  profile: UserProfile | null;
  missingConfig: string[];
  error: string | null;
  setError: (error: string | null) => void;
  /** Settings with defaults applied — never undefined once signed in. */
  settings: () => UserSettings;
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  storagePersistence: 'unsupported',
  user: null,
  profile: null,
  missingConfig: [],
  error: null,
  setError: (error) => set({ error }),
  settings: () => get().profile?.settings ?? defaultUserSettings(),
}));

let unsubscribeProfile: (() => void) | null = null;

/**
 * Boots auth. Called once from main.tsx.
 *
 * Anonymous auth is deliberately absent (SPEC 8): this database holds
 * identifiable patient data, and an anonymous uid is an unrecoverable
 * credential — losing it would strand a resident's entire ward list.
 */
export function initSession(): () => void {
  const init = initFirebase();
  if (!init.ok) {
    useSession.setState({ status: 'unconfigured', missingConfig: init.missing });
    return () => undefined;
  }

  const { auth } = init.services;

  // Completes signInWithRedirect, which is the only flow that works inside an
  // iOS standalone PWA (popups are blocked there).
  void getRedirectResult(auth).catch((error: unknown) => {
    console.error('[auth] redirect result failed', error);
    useSession.setState({ error: describeAuthError(error) });
  });

  return onAuthStateChanged(auth, (user) => {
    unsubscribeProfile?.();
    unsubscribeProfile = null;

    if (!user) {
      useSession.setState({ status: 'signed-out', user: null, profile: null });
      return;
    }

    useSession.setState({ status: 'signed-in', user });

    /**
     * Ask for persistent storage once we have a session to protect.
     *
     * Requested here rather than at boot because browsers weigh site
     * engagement, and a signed-in user is the strongest signal we can offer.
     * The result is advisory — Settings surfaces it, since "install the app"
     * is only useful advice to someone whose storage is still evictable.
     */
    void requestPersistentStorage().then((state) => {
      useSession.setState({ storagePersistence: state });
      if (state !== 'persisted') {
        console.warn('[storage] not persistent — session may be evicted', state);
      }
    });

    void bootstrapAccount(user);

    unsubscribeProfile = subscribeProfile(
      user.uid,
      (profile) => useSession.setState({ profile }),
      (error) => {
        console.error('[auth] profile subscription failed', error);
        useSession.setState({ error: 'Gagal memuat pengaturan.' });
      },
    );
  });
}

async function bootstrapAccount(user: User): Promise<void> {
  try {
    await ensureProfile(user);
    await seedSettingsIfMissing(user.uid);
  } catch (error) {
    // Offline first sign-in: these writes stay queued and apply on reconnect,
    // so this is a warning rather than a blocker.
    console.warn('[auth] account bootstrap deferred', error);
  }
}

function isStandalonePwa(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export async function signInWithGoogle(): Promise<void> {
  const { auth } = services();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    if (isStandalonePwa()) {
      await signInWithRedirect(auth, provider);
      return;
    }
    await signInWithPopup(auth, provider);
  } catch (error) {
    // A blocked popup is common on iOS/Safari even outside standalone mode.
    if (isPopupProblem(error)) {
      await signInWithRedirect(auth, provider);
      return;
    }
    useSession.setState({ error: describeAuthError(error) });
    throw error;
  }
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { auth } = services();
  try {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  } catch (error) {
    useSession.setState({ error: describeAuthError(error) });
    throw error;
  }
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<void> {
  const { auth } = services();
  try {
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (displayName.trim()) {
      await updateProfile(credential.user, { displayName: displayName.trim() });
    }
  } catch (error) {
    useSession.setState({ error: describeAuthError(error) });
    throw error;
  }
}

/**
 * SPEC F1 / 18 — sign-out clears the local cache AND localBase.
 *
 * Leaving one account's note bodies in IndexedDB while a colleague signs in on
 * the same laptop is a privacy defect. Firestore's cache can only be cleared
 * while the client is terminated, and the client cannot be restarted in place,
 * so the page reloads afterwards. That is intentional, not a workaround.
 */
export async function signOutAndClear(): Promise<void> {
  const { auth, db } = services();
  unsubscribeProfile?.();
  unsubscribeProfile = null;

  await signOut(auth);
  await clearLocalBase();

  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch (error) {
    // Another open tab holds the cache. Surface it rather than pretending the
    // data is gone — the user needs to know to close the other tab.
    console.error('[auth] could not clear offline cache', error);
  }

  window.location.replace(import.meta.env.BASE_URL);
}

function isPopupProblem(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code ?? '';
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/operation-not-supported-in-this-environment' ||
    code === 'auth/cancelled-popup-request'
  );
}

/** Bahasa Indonesia messages; never leaks the raw Firebase code to the user. */
function describeAuthError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email atau kata sandi salah.';
    case 'auth/email-already-in-use':
      return 'Email ini sudah terdaftar.';
    case 'auth/weak-password':
      return 'Kata sandi minimal 6 karakter.';
    case 'auth/invalid-email':
      return 'Format email tidak valid.';
    case 'auth/network-request-failed':
      return 'Tidak ada koneksi. Masuk memerlukan internet sekali di awal.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan. Coba lagi beberapa menit.';
    case 'auth/unauthorized-domain':
      return 'Domain ini belum diizinkan di Firebase Authentication.';
    default:
      return 'Gagal masuk. Coba lagi.';
  }
}
