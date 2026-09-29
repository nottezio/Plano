/**
 * Recovery from a stale precached shell.
 *
 * A deploy replaces every hashed chunk. If the service worker is still serving
 * the previous `index.html` — because the update was found but never applied —
 * that HTML asks for filenames the server no longer has, and the app fails to
 * boot with a chunk load error. It is intermittent by nature: it depends on
 * whether a deploy landed between two visits, which is exactly why it looks
 * random.
 *
 * The fix is narrow on purpose. A blanket "reload on any error" is a reload
 * loop waiting to happen, so this fires only for the specific failure — a
 * dynamic import or a missing asset — and only ONCE per session, recorded in
 * sessionStorage. If it fails again after a clean reload, the problem is not a
 * stale cache and looping would only hide it.
 */

import { cleanReload } from './cleanReload';

const FLAG = 'visite.chunkRecovery';

function looksLikeStaleChunk(message: string): boolean {
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /ChunkLoadError/i.test(message)
  );
}

async function recover(): Promise<void> {
  try {
    sessionStorage.setItem(FLAG, '1');
  } catch {
    // Private mode with no storage: recovery still runs, it just cannot be
    // limited to once. Better than a permanently broken app.
  }

  await cleanReload();
}

export function installChunkRecovery(): void {
  const alreadyTried = (() => {
    try {
      return sessionStorage.getItem(FLAG) === '1';
    } catch {
      return false;
    }
  })();

  window.addEventListener('error', (event) => {
    const message = event.message ?? '';
    if (alreadyTried || !looksLikeStaleChunk(message)) return;
    void recover();
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as { message?: string } | undefined;
    if (alreadyTried || !looksLikeStaleChunk(reason?.message ?? '')) return;
    void recover();
  });
}

/** Cleared once the app has rendered, so the next real failure can recover. */
export function markBootSucceeded(): void {
  try {
    sessionStorage.removeItem(FLAG);
  } catch {
    // Nothing to clear.
  }
}
