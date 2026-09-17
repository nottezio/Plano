import {
  collectionGroup,
  getDoc,
  getDocsFromCache,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  collection,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '../firebase';
import { accessCol, accessConfigDoc, accessDoc } from '../paths';
import { trackWrite } from '../syncStatus';
import type { AccessRecord, AccessStats, AccessStatus } from '@/domain/access';

/**
 * Firestore access for access control. The rules decide; this only reads and
 * writes what they allow.
 */

const toDate = (value: unknown): Date | null =>
  value && typeof (value as Timestamp).toDate === 'function' ? (value as Timestamp).toDate() : null;

const asStatus = (value: unknown): AccessStatus =>
  value === 'approved' || value === 'revoked' ? value : 'pending';

function toRecord(uid: string, data: Record<string, unknown>): AccessRecord {
  const stats = data.stats as Record<string, unknown> | undefined;
  return {
    uid,
    email: typeof data.email === 'string' ? data.email : '',
    displayName: typeof data.displayName === 'string' ? data.displayName : '',
    status: asStatus(data.status),
    firstSeenAt: toDate(data.firstSeenAt),
    lastSeenAt: toDate(data.lastSeenAt),
    device: typeof data.device === 'string' ? data.device : '',
    appVersion: typeof data.appVersion === 'string' ? data.appVersion : '',
    stats: stats
      ? {
          patients: Number(stats.patients) || 0,
          entries: Number(stats.entries) || 0,
          approxKb: Number(stats.approxKb) || 0,
          at: toDate(stats.at),
        }
      : null,
    decidedAt: toDate(data.decidedAt),
  };
}

/**
 * The switch and this account's own status, live.
 *
 * Each value is reported only once it is KNOWN. A cache miss before the
 * server has answered is not "off" and not "no record": reporting it as
 * either would flash the wrong screen at an approved resident on a new
 * device.
 */
export function subscribeOwnAccess(
  uid: string,
  onEnforce: (enforce: boolean) => void,
  onStatus: (status: AccessStatus | null) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const offConfig = onSnapshot(
    accessConfigDoc(),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!snapshot.exists() && snapshot.metadata.fromCache) return;
      onEnforce(snapshot.exists() && snapshot.data()?.['enforce'] === true);
    },
    onError,
  );
  const offOwn = onSnapshot(
    accessDoc(uid),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!snapshot.exists() && snapshot.metadata.fromCache) return;
      onStatus(snapshot.exists() ? asStatus(snapshot.data()?.['status']) : null);
    },
    onError,
  );
  return () => {
    offConfig();
    offOwn();
  };
}

/**
 * Create or refresh this account's record. Creates as `pending`; afterwards
 * touches only the registry fields, never `status` (the rules refuse it).
 */
export async function registerSelf(
  uid: string,
  fields: { email: string; displayName: string; device: string; appVersion: string },
): Promise<void> {
  const ref = accessDoc(uid);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    await trackWrite(
      setDoc(ref, {
        uid,
        ...fields,
        status: 'pending',
        firstSeenAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
      }),
    );
    return;
  }
  await trackWrite(updateDoc(ref, { ...fields, lastSeenAt: serverTimestamp() }));
}

export function reportStats(uid: string, stats: AccessStats): Promise<void> {
  return trackWrite(
    updateDoc(accessDoc(uid), { stats: { ...stats, at: serverTimestamp() } }),
  );
}

/**
 * The size of THIS DEVICE's copy of the account's data, from the local cache
 * only: no server reads, no cost. Approximate by construction: JSON length,
 * not Firestore's billed size, and only what this device has opened.
 */
export async function measureLocalCopy(): Promise<AccessStats> {
  const [patients, entries] = await Promise.all([
    getDocsFromCache(collection(db(), 'patients')),
    getDocsFromCache(collectionGroup(db(), 'entries')),
  ]);
  let bytes = 0;
  for (const snapshot of [...patients.docs, ...entries.docs]) {
    bytes += JSON.stringify(snapshot.data()).length;
  }
  return {
    patients: patients.size,
    entries: entries.size,
    approxKb: Math.round(bytes / 1024),
  };
}

/* ------------------------------------------------------------------------ */
/* Admin only. The rules refuse these for anyone else.                      */
/* ------------------------------------------------------------------------ */

export function subscribeAllAccess(
  onChange: (records: AccessRecord[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    accessCol(),
    (snapshot) => {
      onChange(snapshot.docs.map((docSnap) => toRecord(docSnap.id, docSnap.data())));
    },
    onError,
  );
}

export function setAccessStatus(uid: string, status: AccessStatus, adminUid: string): Promise<void> {
  return trackWrite(
    updateDoc(accessDoc(uid), {
      status,
      decidedAt: serverTimestamp(),
      decidedBy: adminUid,
    }),
  );
}

export function setEnforcement(enforce: boolean, adminUid: string): Promise<void> {
  return trackWrite(
    setDoc(accessConfigDoc(), {
      enforce,
      updatedAt: serverTimestamp(),
      updatedBy: adminUid,
    }),
  );
}

export function subscribeEnforcement(
  onChange: (enforce: boolean) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    accessConfigDoc(),
    (snapshot) => onChange(snapshot.exists() && snapshot.data()?.['enforce'] === true),
    onError,
  );
}
