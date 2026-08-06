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
 * Activates the waiting worker and reloads. The caller MUST have confirmed
 * that no editor is dirty — see useUI.hasUnsavedWork.
 */
export async function applyUpdate(): Promise<void> {
  if (!applyUpdateFn) return;
  await applyUpdateFn();
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
