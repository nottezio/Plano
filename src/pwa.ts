/**
 * Service-worker registration and the update flow (SPEC 17).
 *
 * Registration is explicit (injectRegister: null in vite.config) so that the
 * *application* owns the moment of reload. The UI never reloads while an
 * editor is dirty; `UpdateBanner` flushes first and then calls `applyUpdate`.
 *
 * Two things here exist because the installed app on a phone behaved worse
 * than a laptop tab:
 *
 * 1. FINDING an update. The browser checks `sw.js` when a page is navigated
 *    to. An installed app on a phone is not navigated: it is resumed from the
 *    background, for days. So the app asks itself: on every return to the
 *    foreground (at most once a minute) and hourly while open.
 *
 * 2. APPLYING it. `updateSW()` only POSTS `SKIP_WAITING` and returns. The old
 *    `applyUpdate` reloaded as soon as it returned, before the new worker had
 *    taken over, so the reload was often answered by the OLD worker: same old
 *    version, banner back, "the button does nothing". Now the reload waits for
 *    the new worker to take control (`controllerchange`), with a timeout that
 *    reloads anyway so the button can never look dead.
 */
import { registerSW } from 'virtual:pwa-register';

export type UpdateState =
  /** Nothing known beyond the running version. */
  | 'idle'
  /** Asking the server. */
  | 'checking'
  /** A new version is downloading in the background. */
  | 'downloading'
  /** Checked just now: this is the newest version. */
  | 'current'
  /** A new version is ready; reload to use it. */
  | 'available'
  /** Switching to the new version. */
  | 'applying'
  /** The check failed (offline, server unreachable). */
  | 'error';

type Listener = (state: UpdateState) => void;

const listeners = new Set<Listener>();
let state: UpdateState = 'idle';
let registration: ServiceWorkerRegistration | null = null;
let postSkipWaiting: (() => Promise<void>) | null = null;
let lastCheck = 0;

const RESUME_CHECK_GAP_MS = 60_000;
const HOURLY_MS = 60 * 60_000;
const TAKEOVER_TIMEOUT_MS = 6_000;

function setState(next: UpdateState): void {
  // Once a new version is ready, only applying it moves the state on.
  if (state === 'available' && next !== 'applying') return;
  if (state === 'applying') return;
  state = next;
  for (const listener of listeners) listener(state);
}

export function onUpdateState(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

/** Kept for the banner: true once a new version is ready. */
export function onUpdateAvailable(listener: (available: boolean) => void): () => void {
  return onUpdateState((next) => listener(next === 'available' || next === 'applying'));
}

/** Watch a worker that is still installing, and report when it is ready. */
const tracked = new WeakSet<ServiceWorker>();

function trackInstalling(worker: ServiceWorker | null): void {
  if (!worker) return;
  setState('downloading');
  if (tracked.has(worker)) return;
  tracked.add(worker);
  worker.addEventListener('statechange', () => {
    if (worker.state === 'installed') {
      // No controller means a first install: nothing to switch from.
      setState(navigator.serviceWorker.controller ? 'available' : 'current');
    }
    if (worker.state === 'redundant') setState('error');
  });
}

/**
 * Ask the server whether there is a newer version.
 *
 * Resolves with the state it ended in. `force` skips the once-a-minute limit
 * (the Settings button); automatic checks do not.
 */
export async function checkForUpdate(force = false): Promise<UpdateState> {
  if (!registration) return state;
  if (state === 'available' || state === 'applying') return state;
  const now = Date.now();
  if (!force && now - lastCheck < RESUME_CHECK_GAP_MS) return state;
  lastCheck = now;

  setState('checking');
  try {
    await registration.update();
  } catch (error) {
    console.warn('[pwa] update check failed', error);
    setState('error');
    return state;
  }
  if (registration.waiting && navigator.serviceWorker.controller) setState('available');
  else if (registration.installing) trackInstalling(registration.installing);
  else setState('current');
  return state;
}

/**
 * Switch to the waiting version and reload into it.
 *
 * Waits for the new worker to take control before reloading, so the reload is
 * served by it. If it never does within a few seconds, reloads anyway.
 */
export async function applyUpdate(): Promise<void> {
  setState('applying');
  let reloading = false;
  const reload = (): void => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  };

  const waiting = registration?.waiting ?? null;
  if (!waiting || !('serviceWorker' in navigator)) {
    reload();
    return;
  }

  navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
  window.setTimeout(reload, TAKEOVER_TIMEOUT_MS);
  try {
    if (postSkipWaiting) await postSkipWaiting();
    else waiting.postMessage({ type: 'SKIP_WAITING' });
  } catch (error) {
    console.error('[pwa] could not activate the new version, reloading anyway', error);
    reload();
  }
}

export function registerServiceWorker(): void {
  if (import.meta.env.DEV) return;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      setState('available');
    },
    onRegisteredSW(_url, registered) {
      if (!registered) return;
      registration = registered;
      // A version found earlier, still waiting, is ready now.
      if (registered.waiting && navigator.serviceWorker.controller) setState('available');
      else if (registered.installing) trackInstalling(registered.installing);
      registered.addEventListener('updatefound', () => trackInstalling(registered.installing));

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void checkForUpdate();
      });
      window.addEventListener('online', () => void checkForUpdate());
      window.setInterval(() => {
        if (document.visibilityState === 'visible') void checkForUpdate();
      }, HOURLY_MS);
    },
    onRegisterError(error) {
      // Never swallow: an unregistered SW means no offline shell, which is a
      // functional failure for a ward with bad wifi.
      console.error('[pwa] service worker registration failed', error);
    },
  });

  postSkipWaiting = async () => {
    await updateSW(false);
  };
}
