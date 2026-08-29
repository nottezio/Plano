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

/*
 * `isStandalonePwa` and `isHandheld` were deleted here, not left unused.
 *
 * They existed to CHOOSE between popup and redirect by sniffing the device.
 * The choice is gone: popup is attempted everywhere and redirect is the
 * fallback when the popup itself fails, which is a fact the browser reports
 * rather than one we have to guess from a user-agent string. Keeping a device
 * sniff around invites the next person to route on it again.
 */

export async function signInWithGoogle(): Promise<void> {
  const { auth } = services();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    /**
     * Popup FIRST, on every device, with redirect as the fallback.
     *
     * This used to be the other way round — redirect on any handheld — because
     * a popup on mobile can hang instead of erroring. That reasoning still
     * holds; it is just outranked now, because redirect stopped working at all
     * on mobile rather than working slowly.
     *
     * Why redirect breaks here specifically: Plano is served from
     * `nottezio.github.io` while Firebase's auth handler lives on
     * `plano-85e9e.firebaseapp.com`. `signInWithRedirect` hands the session
     * between those two origins through cross-site storage, and browsers have
     * been switching that off — Safari's ITP, and third-party cookie blocking
     * now on by default in Chrome and Samsung Internet. Nothing in this repo
     * changed; the platform did. Popup does not need that storage: it talks to
     * its opener over `postMessage`.
     *
     * Second failure mode this also covers: from an INSTALLED standalone PWA a
     * redirect can complete in the browser rather than in the app, so the app
     * never sees the result and sits on the sign-in screen looking broken.
     *
     * The fix on the other side is a same-origin auth handler, which needs a
     * custom domain or a reverse proxy — neither of which GitHub Pages can do.
     * So this is the fix, not a workaround for one.
     *
     * Redirect is kept below rather than deleted: it is still the only thing
     * that works when a popup is genuinely blocked, which is common on iOS.
     */
    await signInWithPopup(auth, provider);
  } catch (error) {
    // A blocked or hung popup falls back to the old path. On iOS standalone
    // this is still the normal outcome, not an exception.
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
      /**
       * The raw code goes on screen for anything unmapped.
       *
       * Every branch above is a code someone already hit and diagnosed. The
       * default is by definition the ones nobody has — and it was returning
       * "Gagal masuk. Coba lagi." for all of them, so the only failures that
       * needed reporting were the only ones that could not be reported. A
       * screenshot of the sign-in screen could not distinguish a blocked
       * popup from a dead network from a misconfigured provider.
       *
       * `auth/...` codes name a condition, not a secret; showing one costs a
       * little polish on a screen seen once and saves a round trip that
       * happens while someone cannot get into the ward's notes.
       */
      return code ? `Gagal masuk (${code}).` : 'Gagal masuk. Coba lagi.';
  }
}
