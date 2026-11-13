import {
  collectionGroup,
  deleteField,
  getDocsFromCache,
  serverTimestamp,
  setDoc,
  updateDoc,
  collection,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDoc, onSnapshot } from '../meteredFirestore';
import { nanoid } from 'nanoid';

import { db } from '../firebase';
import { accessCol, accessConfigDoc, accessDoc } from '../paths';
import { trackWrite } from '../syncStatus';
import type { AccessConfig, AccessRecord, AccessStats, AccessStatus } from '@/domain/access';
import { isValidAppVersion } from '@/domain/appVersion';
import { NOTICE_MAX, type AccessNotice, type NoticeTone } from '@/domain/notice';
import type { DeviceUsage } from '@/domain/usage';

/**
 * Firestore access for access control. The rules decide; this only reads and
 * writes what they allow.
 */

const toDate = (value: unknown): Date | null =>
  value && typeof (value as Timestamp).toDate === 'function' ? (value as Timestamp).toDate() : null;

const asStatus = (value: unknown): AccessStatus =>
  value === 'approved' || value === 'viewer' || value === 'revoked' ? value : 'pending';

/** A message that cannot be read as one is no message. */
function toNotice(value: unknown): AccessNotice | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (typeof data.id !== 'string' || !data.id) return null;
  if (typeof data.text !== 'string' || !data.text.trim()) return null;
  return {
    id: data.id,
    text: data.text.slice(0, NOTICE_MAX),
    tone: data.tone === 'penting' ? 'penting' : 'info',
    createdAt: toDate(data.createdAt),
    expiresAt: toDate(data.expiresAt),
  };
}

const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0);

/** Each device's self-reported usage; anything malformed is skipped, never trusted. */
function toUsage(value: unknown): Record<string, DeviceUsage> {
  const out: Record<string, DeviceUsage> = {};
  if (!value || typeof value !== 'object') return out;
  for (const [device, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const data = raw as Record<string, unknown>;
    if (typeof data.day !== 'string') continue;
    const week: Record<string, number> = {};
    if (data.week && typeof data.week === 'object') {
      for (const [day, reads] of Object.entries(data.week as Record<string, unknown>)) week[day] = count(reads);
    }
    const top = Array.isArray(data.top)
      ? data.top.flatMap((source: unknown) => {
          const entry = source as { l?: unknown; r?: unknown } | null;
          return entry && typeof entry.l === 'string' ? [{ l: entry.l, r: count(entry.r) }] : [];
        })
      : [];
    out[device] = {
      day: data.day,
      reads: count(data.reads),
      writes: count(data.writes),
      errors: count(data.errors),
      top,
      week,
    };
  }
  return out;
}

/** An unreadable `minVersion` counts as none: a typo must never nag everyone. */
function toConfig(data: Record<string, unknown> | undefined): AccessConfig {
  const minVersion = data?.['minVersion'];
  return {
    enforce: data?.['enforce'] === true,
    minVersion: typeof minVersion === 'string' && isValidAppVersion(minVersion) ? minVersion.trim() : null,
    notice: toNotice(data?.['notice']),
  };
}

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
    host: typeof data.host === 'string' ? data.host : '',
    notice: toNotice(data.notice),
    usage: toUsage(data.usage),
    lastAdminViewAt: toDate(data.lastAdminViewAt),
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
  onConfig: (config: AccessConfig) => void,
  onStatus: (status: AccessStatus | null, notice: AccessNotice | null, lastAdminViewAt: Date | null) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const offConfig = onSnapshot(
    accessConfigDoc(),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!snapshot.exists() && snapshot.metadata.fromCache) return;
      onConfig(toConfig(snapshot.exists() ? snapshot.data() : undefined));
    },
    onError,
  );
  const offOwn = onSnapshot(
    accessDoc(uid),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!snapshot.exists() && snapshot.metadata.fromCache) return;
      onStatus(
        snapshot.exists() ? asStatus(snapshot.data()?.['status']) : null,
        snapshot.exists() ? toNotice(snapshot.data()?.['notice']) : null,
        snapshot.exists() ? toDate(snapshot.data()?.['lastAdminViewAt']) : null,
      );
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
  fields: { email: string; displayName: string; device: string; appVersion: string; host: string },
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

/**
 * The six-hourly report: the size of this device's copy and its usage
 * estimate, in ONE write. The usage goes under this device's own key so two
 * devices on one account do not overwrite each other. The key is made safe for
 * a field path (letters, digits, underscore).
 */
export function reportStats(
  uid: string,
  stats: AccessStats,
  usage: { deviceId: string; report: DeviceUsage },
): Promise<void> {
  const device = `d${usage.deviceId.replace(/[^A-Za-z0-9_]/g, '_')}`;
  return trackWrite(
    updateDoc(accessDoc(uid), {
      stats: { ...stats, at: serverTimestamp() },
      [`usage.${device}`]: usage.report,
    }),
  );
}

/**
 * The size of THIS DEVICE's copy of the account's data, from the local cache
 * only: no server reads, no cost. Approximate by construction: JSON length,
 * not Firestore's billed size, and only what this device has opened.
 */
export async function measureLocalCopy(uid: string): Promise<AccessStats> {
  const [allPatients, allEntries] = await Promise.all([
    getDocsFromCache(collection(db(), 'patients')),
    getDocsFromCache(collectionGroup(db(), 'entries')),
  ]);
  // Only this account's own patients. The admin's cache can also hold other
  // accounts' patients opened in the Pasien tab; those are not its copy.
  const patients = allPatients.docs.filter((snapshot) => {
    const members: unknown = snapshot.data().memberIds;
    return Array.isArray(members) && members.includes(uid);
  });
  const own = new Set(patients.map((snapshot) => snapshot.id));
  const entries = allEntries.docs.filter((snapshot) => own.has(snapshot.ref.parent.parent?.id ?? ''));
  let bytes = 0;
  for (const snapshot of [...patients, ...entries]) {
    bytes += JSON.stringify(snapshot.data()).length;
  }
  return {
    patients: patients.length,
    entries: entries.length,
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

/**
 * `config/access` also holds the minimum version, so every write here MERGES:
 * a plain set would wipe the fields it does not mention.
 */
export function setEnforcement(enforce: boolean, adminUid: string): Promise<void> {
  return trackWrite(
    setDoc(
      accessConfigDoc(),
      { enforce, updatedAt: serverTimestamp(), updatedBy: adminUid },
      { merge: true },
    ),
  );
}

/** `null` removes the minimum. */
export function setMinVersion(minVersion: string | null, adminUid: string): Promise<void> {
  return trackWrite(
    setDoc(
      accessConfigDoc(),
      {
        minVersion: minVersion === null ? deleteField() : minVersion,
        updatedAt: serverTimestamp(),
        updatedBy: adminUid,
      },
      { merge: true },
    ),
  );
}

/**
 * Record that the admin is opening this account's patients. The account sees
 * the time in Akun. Written BEFORE anything is read, and the caller does not
 * read if it fails: no stamp, no view. One write.
 */
export function stampAdminView(uid: string): Promise<void> {
  return trackWrite(updateDoc(accessDoc(uid), { lastAdminViewAt: serverTimestamp() }));
}

/**
 * Send a message to everyone (`'all'`, on `config/access`) or to one account.
 * One message per target: sending again replaces the last. Each open app
 * already listening to that document reads it once (1 read per account).
 */
export function sendNotice(
  target: 'all' | string,
  input: { text: string; tone: NoticeTone; expiresAt: Date | null },
  adminUid: string,
): Promise<void> {
  const notice = {
    id: nanoid(10),
    text: input.text.trim().slice(0, NOTICE_MAX),
    tone: input.tone,
    createdAt: serverTimestamp(),
    expiresAt: input.expiresAt ? Timestamp.fromDate(input.expiresAt) : null,
  };
  return trackWrite(
    target === 'all'
      ? setDoc(accessConfigDoc(), { notice, updatedAt: serverTimestamp(), updatedBy: adminUid }, { merge: true })
      : updateDoc(accessDoc(target), { notice }),
  );
}

export function clearNotice(target: 'all' | string, adminUid: string): Promise<void> {
  return trackWrite(
    target === 'all'
      ? setDoc(
          accessConfigDoc(),
          { notice: deleteField(), updatedAt: serverTimestamp(), updatedBy: adminUid },
          { merge: true },
        )
      : updateDoc(accessDoc(target), { notice: deleteField() }),
  );
}

export function subscribeAccessConfig(
  onChange: (config: AccessConfig) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    accessConfigDoc(),
    (snapshot) => onChange(toConfig(snapshot.exists() ? snapshot.data() : undefined)),
    onError,
  );
}
