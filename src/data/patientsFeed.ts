import { subscribePatients } from './repositories/patients.repo';
import type { Patient, PatientStatus } from '@/domain/types';

/**
 * Patient lists, one live query per (account, status), shared by every screen.
 *
 * WHY THIS EXISTS (2026-10-02, "frequently Memuat")
 *
 * Each screen used to open its own query when it mounted and close it when it
 * left. Going Aktif → a patient → back to Aktif therefore closed the board's
 * query, opened a new one, and showed "Memuat…" until Firestore had re-run it
 * against its IndexedDB cache — on a phone, often a second or more for a
 * full ward list. Every return to the board, every visit to Arsip, paid it
 * again, which is what "the app frequently loads" was.
 *
 * Now the query outlives the screen. The first screen to ask starts it; when
 * the last one leaves it LINGERS (the active list for the whole session,
 * others for a few minutes), so coming back renders the list already held,
 * with no loading state at all. Sign-out or a different account drops
 * everything.
 *
 * The reattach-on-error behaviour moved here unchanged from `usePatients`:
 * Firestore's error callback means the listener is dead, so it is restarted
 * with a capped, jittered backoff, and the last good list is kept meanwhile.
 */

export interface PatientsResult {
  patients: Patient[];
  loading: boolean;
  fromCache: boolean;
  error: string | null;
}

const RETRY_MS = [1_000, 2_000, 5_000, 10_000, 30_000] as const;
/** How long a list nobody is looking at is kept live. `active` never stops. */
const LINGER_MS = 5 * 60_000;

const LOADING: PatientsResult = { patients: [], loading: true, fromCache: true, error: null };
const IDLE: PatientsResult = { patients: [], loading: false, fromCache: true, error: null };

interface Feed {
  result: PatientsResult;
  listeners: Set<() => void>;
  consumers: number;
  unsubscribe: (() => void) | null;
  retry: ReturnType<typeof setTimeout> | null;
  linger: ReturnType<typeof setTimeout> | null;
  attempt: number;
  lastGood: Patient[];
}

const feeds = new Map<string, Feed>();

function feedKey(uid: string, status: PatientStatus): string {
  return `${uid}|${status}`;
}

function emit(feed: Feed, result: PatientsResult): void {
  feed.result = result;
  for (const listener of feed.listeners) listener();
}

function attach(feed: Feed, uid: string, status: PatientStatus): void {
  feed.unsubscribe = subscribePatients(
    uid,
    status,
    (snapshot) => {
      feed.attempt = 0;
      feed.lastGood = snapshot.patients;
      emit(feed, {
        patients: snapshot.patients,
        loading: false,
        fromCache: snapshot.fromCache,
        error: null,
      });
    },
    (error) => {
      // A missing composite index shows up here and nowhere else.
      console.error('[patients] query failed', status, error);
      emit(feed, {
        patients: feed.lastGood,
        loading: false,
        fromCache: true,
        error: 'Gagal memuat daftar pasien. Mencoba menyambung ulang…',
      });
      feed.unsubscribe?.();
      feed.unsubscribe = null;
      const delay = RETRY_MS[Math.min(feed.attempt, RETRY_MS.length - 1)] ?? 30_000;
      feed.attempt += 1;
      feed.retry = setTimeout(() => {
        feed.retry = null;
        if (feeds.get(feedKey(uid, status)) === feed) attach(feed, uid, status);
      }, delay + Math.random() * 500);
    },
  );
}

function stop(key: string): void {
  const feed = feeds.get(key);
  if (!feed) return;
  feed.unsubscribe?.();
  if (feed.retry) clearTimeout(feed.retry);
  if (feed.linger) clearTimeout(feed.linger);
  feeds.delete(key);
}

/** Start using a list. Returns the release function. */
export function acquirePatients(uid: string, status: PatientStatus): () => void {
  const key = feedKey(uid, status);
  // A different account: nothing of the previous one may survive.
  for (const other of [...feeds.keys()]) {
    if (!other.startsWith(`${uid}|`)) stop(other);
  }
  let feed = feeds.get(key);
  if (!feed) {
    feed = {
      result: LOADING,
      listeners: new Set(),
      consumers: 0,
      unsubscribe: null,
      retry: null,
      linger: null,
      attempt: 0,
      lastGood: [],
    };
    feeds.set(key, feed);
    attach(feed, uid, status);
  }
  if (feed.linger) {
    clearTimeout(feed.linger);
    feed.linger = null;
  }
  feed.consumers += 1;

  const held = feed;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    held.consumers -= 1;
    if (held.consumers > 0 || status === 'active') return;
    held.linger = setTimeout(() => {
      if (held.consumers === 0) stop(key);
    }, LINGER_MS);
  };
}

export function readPatients(uid: string | null, status: PatientStatus, enabled: boolean): PatientsResult {
  if (!uid || !enabled) return IDLE;
  return feeds.get(feedKey(uid, status))?.result ?? LOADING;
}

export function watchPatients(uid: string, status: PatientStatus, listener: () => void): () => void {
  const feed = feeds.get(feedKey(uid, status));
  if (!feed) return () => undefined;
  feed.listeners.add(listener);
  return () => feed.listeners.delete(listener);
}

/** A patient from any live list, for an instant first paint of its page. */
export function findCachedPatient(uid: string | null, patientId: string): Patient | null {
  if (!uid) return null;
  for (const [key, feed] of feeds) {
    if (!key.startsWith(`${uid}|`)) continue;
    const found = feed.result.patients.find((patient) => patient.id === patientId);
    if (found) return found;
  }
  return null;
}

/** Sign-out: drop every list. */
export function resetPatientFeeds(): void {
  for (const key of [...feeds.keys()]) stop(key);
}
