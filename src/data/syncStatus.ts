import { logSessionEvent } from '@/lib/sessionLog';
import { useUI } from '@/store/useUI';

/**
 * SPEC 7.4 — the sync pill.
 *
 * Firestore has no "pending mutation count" API. The reliable signal is the
 * write promise itself: `setDoc`/`updateDoc` resolve only on *server* ack, so
 * offline they stay pending for exactly as long as the mutation sits in the
 * queue. Counting unsettled write promises therefore counts queued changes,
 * with no polling and no second source of truth.
 *
 * Caveat, stated rather than hidden: this counts writes issued by *this* tab
 * since load. Mutations queued before a reload are still replayed by Firestore
 * — they just are not in this counter. `navigator.onLine` covers that case by
 * showing the offline state regardless of count.
 */

let pending = 0;
let online = typeof navigator === 'undefined' ? true : navigator.onLine;

/**
 * Writes the server refused since the user last acknowledged it.
 *
 * Every repository write goes through `trackWrite`, so this is the one place
 * a refusal can be seen. It used to end in `console.error` only, and the pill
 * went back to "Synced": a rules or quota refusal looked exactly like success
 * (PRODUCT.md principles 1 and 5).
 */
let failed = 0;
let lastCode: string | undefined;
let lastAt = 0;

/** `permission-denied`, `resource-exhausted`, …; only the code, never the message (it can carry document paths). */
function errorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

function publish(): void {
  const setSync = useUI.getState().setSync;
  // A refusal outranks offline: offline writes are queued and will go, a
  // refused one will not.
  if (failed > 0) {
    setSync({ kind: 'error', failed, code: lastCode, at: lastAt });
    return;
  }
  if (!online) {
    setSync({ kind: 'offline', pending });
    return;
  }
  setSync(pending > 0 ? { kind: 'saving' } : { kind: 'synced' });
}

/**
 * Wraps a repository write. Returns the same promise so callers may ignore it
 * (optimistic UI) or await it (explicit "saved" confirmation) unchanged.
 */
export function trackWrite<T>(promise: Promise<T>): Promise<T> {
  pending += 1;
  publish();

  const settle = (): void => {
    pending = Math.max(0, pending - 1);
    publish();
  };

  promise.then(settle, (error: unknown) => {
    // A rejected write offline is not normal — Firestore keeps those
    // pending — so a rejection here means a rules failure, quota, or a bug.
    failed += 1;
    lastCode = errorCode(error);
    lastAt = Date.now();
    logSessionEvent('write-rejected', lastCode ?? (error instanceof Error ? error.name : typeof error));
    console.error('[sync] write rejected', error);
    settle();
  });

  return promise;
}

/** The user has seen the failure (the pill's sheet). Back to the live state. */
export function acknowledgeWriteFailures(): void {
  failed = 0;
  lastCode = undefined;
  lastAt = 0;
  publish();
}

export function initSyncStatus(): () => void {
  const goOnline = (): void => {
    online = true;
    publish();
  };
  const goOffline = (): void => {
    online = false;
    publish();
  };

  window.addEventListener('online', goOnline);
  window.addEventListener('offline', goOffline);
  publish();

  return () => {
    window.removeEventListener('online', goOnline);
    window.removeEventListener('offline', goOffline);
  };
}

/** Test/diagnostic hook. Not used by the UI. */
export function pendingWriteCount(): number {
  return pending;
}
