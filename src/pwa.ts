/**
 * Service-worker registration and the update gate (SPEC 17).
 *
 * Registration is explicit (injectRegister: null in vite.config) so that the
 * *application* owns the moment of reload. `applyUpdate()` refuses to run
 * while any editor reports itself dirty — that check lives in the UI store, so
 * this module exposes a hook rather than deciding for itself.
 */
import { registerSW } from 'virtual:pwa-register';

type UpdateListener = (needRefresh: boolean) => void;

let applyUpdateFn: (() => Promise<void>) | null = null;
const listeners = new Set<UpdateListener>();
let needRefresh = false;

function emit(): void {
  for (const listener of listeners) listener(needRefresh);
}

export function onUpdateAvailable(listener: UpdateListener): () => void {
  listeners.add(listener);
  listener(needRefresh);
  return () => listeners.delete(listener);
}

/**
 * Activates the waiting worker and reloads.
 *
 * `updateSW(true)` posts SKIP_WAITING and reloads when `controllerchange`
 * fires. When that event never arrives — a worker that fails to activate, or a
 * page with no controller at all — the promise simply never settles and the
 * button looks dead. That is what "Muat ulang tidak dapat dipencet" was: the
 * click worked, and nothing downstream of it did.
 *
 * So the reload is guaranteed here rather than delegated. If the normal path
 * has not torn the page down within two seconds, this reloads directly. A
 * duplicate reload is invisible; a button that does nothing is not.
 */
export async function applyUpdate(): Promise<void> {
  const fallback = window.setTimeout(() => {
    window.location.reload();
  }, 2000);

  try {
    if (applyUpdateFn) await applyUpdateFn();
  } catch (error) {
    console.error('[pwa] update failed, reloading anyway', error);
  } finally {
    window.clearTimeout(fallback);
    // Reached only if `updateSW` resolved without reloading, which happens when
    // there was no waiting worker to activate in the first place.
    window.location.reload();
  }
}

export function registerServiceWorker(): void {
  if (import.meta.env.DEV) return;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      needRefresh = true;
      emit();
    },
    onRegisterError(error) {
      // Never swallow: an unregistered SW means no offline shell, which is a
      // functional failure for a ward with bad wifi.
      console.error('[pwa] service worker registration failed', error);
    },
  });

  applyUpdateFn = async () => {
    await updateSW(true);
  };
}
