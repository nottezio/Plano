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

function publish(): void {
  const setSync = useUI.getState().setSync;
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
    settle();
    // Never swallow. A rejected write offline is not normal — Firestore keeps
    // those pending — so a rejection here means a rules failure or a bug.
    console.error('[sync] write rejected', error);
  });

  return promise;
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
