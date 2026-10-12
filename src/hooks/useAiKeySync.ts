import { useEffect } from 'react';

import { subscribeAiAccount, writeAiAccount } from '@/data/repositories/aiKey.repo';
import { readAiFlags, readApiKey, writeAiFlags, writeApiKey, type AiFlags } from '@/lib/ai';
import { AI_CHANGED_EVENT, isAiPushPending } from '@/lib/aiSync';
import { useSession } from '@/store/useSession';

/**
 * The AI key and switches follow the ACCOUNT (Avi, 2026-10-12), not the
 * device: paste the key once, and every device signed in to the account has
 * it, including after sign-out and back in.
 *
 * localStorage stays the working copy (`readApiKey` is read synchronously at
 * every call site) and is still cleared at sign-out; this hook refills it from
 * `users/{uid}/private/ai`. Mounted once, for the signed-in app.
 *
 * First server answer with no document: this device's key (if any) is
 * uploaded, so a key pasted before 12.6 reaches the account once.
 */
export function useAiKeySync(): void {
  const uid = useSession((state) => state.user?.uid ?? null);

  useEffect(() => {
    if (!uid) return undefined;
    let reconciled = false;
    return subscribeAiAccount(
      uid,
      (remote, { fromCache, pending }) => {
        if (pending || isAiPushPending()) return;
        if (!remote) {
          if (fromCache || reconciled) return;
          reconciled = true;
          const key = readApiKey();
          if (key) void writeAiAccount(uid, { key, flags: readAiFlags() }).catch(() => undefined);
          return;
        }
        if (!fromCache) reconciled = true;
        const flags: AiFlags = { ...readAiFlags(), ...remote.flags };
        const changed =
          remote.key !== readApiKey() || JSON.stringify(flags) !== JSON.stringify(readAiFlags());
        if (!changed) return;
        writeApiKey(remote.key);
        writeAiFlags(flags);
        window.dispatchEvent(new Event(AI_CHANGED_EVENT));
      },
      (error) => console.error('[ai] account listener failed', error),
    );
  }, [uid]);
}
