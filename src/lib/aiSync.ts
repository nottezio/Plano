import { writeAiAccount } from '@/data/repositories/aiKey.repo';
import { readAiFlags, readApiKey } from './ai';

/**
 * Pushing the device's AI key and switches to the account (12.6), debounced:
 * the key field writes per keystroke, the account once typing pauses.
 *
 * `isAiPushPending` tells `useAiKeySync` not to apply a snapshot while a push
 * is waiting — the echo of an earlier push would otherwise overwrite the
 * characters typed since.
 */

const DELAY_MS = 800;
let timer: ReturnType<typeof setTimeout> | null = null;

export function scheduleAiPush(uid: string | null): void {
  if (!uid) return;
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void writeAiAccount(uid, { key: readApiKey(), flags: readAiFlags() }).catch((error: unknown) =>
      console.error('[ai] account write rejected', error),
    );
  }, DELAY_MS);
}

export function isAiPushPending(): boolean {
  return timer !== null;
}

/** Fired after the account's key or switches were applied to this device. */
export const AI_CHANGED_EVENT = 'plano:ai-changed';
