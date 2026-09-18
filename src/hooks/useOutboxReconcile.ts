import { useEffect, useState } from 'react';

import { reconcileOutbox, type ReconcileResult } from '@/data/reconcileOutbox';
import { useSession } from '@/store/useSession';

/**
 * Settles unconfirmed body writes at startup and on reconnect.
 *
 * Mounted once, in the app shell, because the writes it settles belong to days
 * that are not on screen — the whole problem is that nobody is looking at them.
 *
 * Only outcomes worth a person's attention are returned: a write that merged,
 * and one that needs review. A write that simply landed is silence.
 */
export function useOutboxReconcile(): {
  results: ReconcileResult[];
  dismiss: () => void;
} {
  const signedIn = useSession((state) => state.status === 'signed-in');
  const [results, setResults] = useState<ReconcileResult[]>([]);

  useEffect(() => {
    if (!signedIn) return undefined;

    let cancelled = false;
    const run = (): void => {
      void reconcileOutbox()
        .then((settled) => {
          if (cancelled) return;
          const notable = settled.filter((result) => result.outcome !== 'landed');
          if (notable.length > 0) setResults((current) => [...current, ...notable]);
        })
        .catch((error: unknown) => console.error('[outbox] reconcile failed', error));
    };

    /*
      A refused write is reconciled within seconds, not at the next startup.
      Debounced: a burst of refusals (a whole carry-forward, say) is one
      reconcile, and the delay lets Firestore settle its local state first.
    */
    let timer = 0;
    const soon = (): void => {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, 2000);
    };

    run();
    window.addEventListener('online', run);
    window.addEventListener('plano:write-refused', soon);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('online', run);
      window.removeEventListener('plano:write-refused', soon);
    };
  }, [signedIn]);

  return { results, dismiss: () => setResults([]) };
}
