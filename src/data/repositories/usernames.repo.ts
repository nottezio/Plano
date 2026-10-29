import { getDocFromServer, runTransaction } from 'firebase/firestore';

import { db } from '../firebase';
import { userDoc, usernameDoc } from '../paths';

/** Thrown when the handle belongs to someone else. */
export class UsernameTakenError extends Error {
  constructor() {
    super('username taken');
  }
}

/**
 * Claim `handle` for this account, releasing the previous one in the same
 * step. A transaction on purpose: it needs a connection and fails at once
 * without one, where a queued write would look saved and could be refused
 * later because someone else took the name meanwhile.
 */
export async function claimUsername(
  uid: string,
  handle: string,
  name: string,
  previous: string | undefined,
): Promise<void> {
  await runTransaction(db(), async (tx) => {
    const existing = await tx.get(usernameDoc(handle));
    if (existing.exists() && existing.data()['uid'] !== uid) throw new UsernameTakenError();
    tx.set(userDoc(uid), { username: handle }, { merge: true });
    tx.set(usernameDoc(handle), { uid, name });
    if (previous && previous !== handle) tx.delete(usernameDoc(previous));
  });
}

/**
 * The account behind an exact handle, or null. Never a search. From the
 * server, so offline throws rather than reporting "not found" from a cache
 * that never held the handle.
 */
export async function lookupUsername(handle: string): Promise<{ uid: string; name: string } | null> {
  const snapshot = await getDocFromServer(usernameDoc(handle));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return { uid: String(data['uid']), name: String(data['name'] ?? '') };
}
