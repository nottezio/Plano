import { useEffect, useState, type ReactNode } from 'react';

import { Footer } from '@/components/common/Footer';
import { describeDevice } from '@/data/deviceId';
import {
  measureLocalCopy,
  registerSelf,
  reportStats,
  subscribeOwnAccess,
} from '@/data/repositories/access.repo';
import {
  LAST_SEEN_EVERY_MS,
  STATS_EVERY_MS,
  decideAccess,
  isDue,
  type AccessStatus,
} from '@/domain/access';
import { signOutAndClear, useSession } from '@/store/useSession';
import { APP_VERSION } from '@/version.js';

/**
 * Shows the app only to an account the admin has approved, once access control
 * is switched on.
 *
 * This is the SCREEN half. The server half is `firestore.rules`, which refuses
 * every read and write from an account that is not approved, whatever this
 * component renders. The two are live: approving someone opens their app
 * without a reload, and revoking closes it.
 */
export function AccessGate({ children }: { children: ReactNode }): JSX.Element {
  const user = useSession((state) => state.user);
  const [enforce, setEnforce] = useState<boolean | null>(null);
  const [status, setStatus] = useState<AccessStatus | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  const uid = user?.uid ?? null;

  useEffect(() => {
    if (!uid) return undefined;
    setEnforce(null);
    setStatus(undefined);
    setFailed(false);
    return subscribeOwnAccess(uid, setEnforce, setStatus, (error) => {
      console.error('[access] could not read access state', error);
      setFailed(true);
    });
  }, [uid]);

  useRegistration(uid, user?.email ?? '', user?.displayName ?? '', status);

  if (!uid) return <>{children}</>;

  const decision = decideAccess({ uid, enforce, status });
  if (decision === 'allowed') return <>{children}</>;

  if (decision === 'unknown') {
    return (
      <Screen title="Memeriksa akses…">
        {failed
          ? 'Tidak dapat memeriksa akses. Periksa koneksi, lalu muat ulang.'
          : 'Pemeriksaan pertama di perangkat ini memerlukan koneksi internet.'}
      </Screen>
    );
  }

  return (
    <Screen title={decision === 'revoked' ? 'Akses dicabut' : 'Menunggu persetujuan'}>
      {decision === 'revoked'
        ? 'Akses akun ini ke Plano telah dicabut oleh admin.'
        : 'Akun ini sudah terdaftar. Plano akan terbuka otomatis setelah admin menyetujuinya.'}
      <span className="mt-2 block font-mono text-xs text-fg-faint">{user?.email}</span>
    </Screen>
  );
}

function Screen({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-fg-muted">{children}</p>
          <button
            type="button"
            onClick={() => void signOutAndClear()}
            className="mt-4 min-h-tap rounded-lg border border-border px-4 text-sm"
          >
            Keluar
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}

const LAST_SEEN_KEY = 'visite.access.lastSeen';
const STATS_KEY = 'visite.access.stats';

function readStamp(key: string, uid: string): number | null {
  try {
    const raw = localStorage.getItem(`${key}.${uid}`);
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
}

function writeStamp(key: string, uid: string, at: number): void {
  try {
    localStorage.setItem(`${key}.${uid}`, String(at));
  } catch {
    // No storage: the write simply repeats next time. Harmless.
  }
}

/**
 * Keeps this account's record current: who, which device, which version,
 * last seen, and the size of this device's copy.
 *
 * Throttled per device (hourly, and six-hourly for the size), so the admin
 * list is fresh without a write on every screen change. Runs for pending
 * accounts too, since that is how the admin learns they exist. Stats are sent
 * only once the record exists, because the rules reject an update to a
 * document that is not there.
 */
function useRegistration(
  uid: string | null,
  email: string,
  displayName: string,
  status: AccessStatus | null | undefined,
): void {
  useEffect(() => {
    if (!uid || status === undefined) return;
    const now = Date.now();

    const registered =
      status === null || isDue(readStamp(LAST_SEEN_KEY, uid), now, LAST_SEEN_EVERY_MS)
        ? registerSelf(uid, {
            email,
            displayName,
            device: describeDevice(),
            appVersion: APP_VERSION,
          }).then(() => writeStamp(LAST_SEEN_KEY, uid, now))
        : Promise.resolve();

    void registered
      .then(async () => {
        if (!isDue(readStamp(STATS_KEY, uid), now, STATS_EVERY_MS)) return;
        await reportStats(uid, await measureLocalCopy());
        writeStamp(STATS_KEY, uid, now);
      })
      .catch((error: unknown) => {
        // Offline, or the record is not there yet. Retried on a later open.
        console.warn('[access] registration deferred', error);
      });
  }, [uid, email, displayName, status]);
}
