import { onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from 'firebase/firestore';

import { aiPrivateDoc } from '../paths';
import { trackWrite } from '../syncStatus';
import type { AiFlags } from '@/lib/ai';

/**
 * The account's Anthropic key and AI switches (12.6): `users/{uid}/private/ai`.
 *
 * A document of its own, NOT a field of the profile: the profile goes into
 * Export data and is read on every screen; the key should be in neither.
 * Owner-only by the rules, like every `users/{uid}` path.
 */

export interface AiAccountState {
  key: string;
  flags: Partial<AiFlags>;
}

export function subscribeAiAccount(
  uid: string,
  callback: (state: AiAccountState | null, meta: { fromCache: boolean; pending: boolean }) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    aiPrivateDoc(uid),
    { includeMetadataChanges: true },
    (snapshot) => {
      const meta = { fromCache: snapshot.metadata.fromCache, pending: snapshot.metadata.hasPendingWrites };
      const data = snapshot.data();
      if (!data) return callback(null, meta);
      const flags: Partial<AiFlags> = {};
      if (data.flags && typeof data.flags === 'object') {
        for (const [name, value] of Object.entries(data.flags as Record<string, unknown>)) {
          if (typeof value === 'boolean') (flags as Record<string, boolean>)[name] = value;
        }
      }
      callback({ key: typeof data.key === 'string' ? data.key : '', flags }, meta);
    },
    onError,
  );
}

/** Whole document: two small fields, edited from one screen. */
export function writeAiAccount(uid: string, state: AiAccountState): Promise<void> {
  return trackWrite(setDoc(aiPrivateDoc(uid), { key: state.key, flags: state.flags, updatedAt: serverTimestamp() }));
}
