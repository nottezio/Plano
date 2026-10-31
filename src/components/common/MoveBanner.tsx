import { useEffect, useState } from 'react';

import { describeDevice, getDeviceId } from '@/data/deviceId';
import { readMoveEntries, removeMoveEntries, writeMoveEntry, type MoveEntry } from '@/data/repositories/move.repo';
import { formatDmy } from '@/domain/dateDmy';
import { moveRole, packSettings, parseMovedTo, planApply } from '@/domain/moveSettings';
import { useSession } from '@/store/useSession';
import { useUI } from '@/store/useUI';
import { IconClose, IconUpload } from './Icons';

/**
 * Moving to a new address (`domain/moveSettings.ts`).
 *
 * Dormant unless the build has `VITE_MOVED_TO` (an https URL). Then:
 * - on any other origin (the old address) it says Plano has moved and offers
 *   to carry this device's local-only settings: wait for Synced, upload them to
 *   the account, open the new address;
 * - on the new address it offers those settings once, per source device.
 *
 * Notes are never carried: they are in Firestore and come back at sign-in.
 * Waiting for Synced is what makes leaving the old address safe.
 */

const MOVED_TO = parseMovedTo((import.meta.env as unknown as Record<string, string | undefined>)['VITE_MOVED_TO']);

export function MoveBanner(): JSX.Element | null {
  const role = moveRole(MOVED_TO, globalThis.location?.origin ?? '');
  if (role === 'old' && MOVED_TO) return <OldAddressBanner target={MOVED_TO} />;
  if (role === 'new') return <NewAddressOffer />;
  return null;
}

const SYNC_WAIT_MS = 15_000;
const UPLOAD_WAIT_MS = 20_000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** True once the sync pill reads Synced, false if it does not within `ms`. */
async function waitForSynced(ms: number): Promise<boolean> {
  const until = Date.now() + ms;
  for (;;) {
    if (navigator.onLine && useUI.getState().sync.kind === 'synced') return true;
    if (Date.now() >= until) return false;
    await wait(250);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

function readLocalEntries(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      const value = localStorage.getItem(key);
      if (value !== null) out.push([key, value]);
    }
  } catch {
    // No storage: nothing to carry.
  }
  return out;
}

type OldPhase =
  | { kind: 'idle' }
  | { kind: 'working'; step: string }
  | { kind: 'error'; message: string }
  | { kind: 'partial'; skipped: number };

function OldAddressBanner({ target }: { target: string }): JSX.Element | null {
  const user = useSession((state) => state.user);
  const [phase, setPhase] = useState<OldPhase>({ kind: 'idle' });
  const [hidden, setHidden] = useState(false);
  const host = new URL(target).host;
  const href = `${target}/`;

  if (hidden) return null;

  const carry = async (): Promise<void> => {
    if (!user) {
      window.location.assign(href);
      return;
    }
    const { hasUnsavedWork, flushAll } = useUI.getState();
    if (hasUnsavedWork()) {
      setPhase({ kind: 'working', step: 'Menyimpan catatan…' });
      flushAll();
      await wait(300);
    }
    setPhase({ kind: 'working', step: 'Menunggu Synced…' });
    if (!(await waitForSynced(SYNC_WAIT_MS))) {
      setPhase({
        kind: 'error',
        message: 'Belum Synced. Sambungkan ke internet dan tunggu sampai tertulis Synced, lalu coba lagi.',
      });
      return;
    }
    const pack = packSettings(readLocalEntries());
    if (pack.carried.length > 0) {
      setPhase({ kind: 'working', step: 'Membawa pengaturan…' });
      try {
        await withTimeout(writeMoveEntry(user.uid, getDeviceId(), describeDevice(), pack.json), UPLOAD_WAIT_MS);
      } catch {
        setPhase({
          kind: 'error',
          message: 'Pengaturan belum terkirim. Coba lagi, atau buka alamat baru tanpa membawanya.',
        });
        return;
      }
    }
    if (pack.skipped.length > 0) {
      setPhase({ kind: 'partial', skipped: pack.skipped.length });
      return;
    }
    window.location.assign(href);
  };

  const working = phase.kind === 'working';

  return (
    <div role="status" className="mx-3 my-3 rounded-xl border border-border bg-bg-subtle px-4 py-3 text-sm">
      <div className="flex items-start gap-3">
        <IconUpload className="mt-0.5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Plano pindah ke {host}</p>
          <p className="mt-0.5 text-xs text-fg-muted">
            Catatan pasien ikut otomatis setelah masuk. Pengaturan di perangkat ini (tema, sticker, coretan, nilai
            rujukan, urutan board) bisa dibawa. PIN dibuat lagi di alamat baru.
          </p>
          {phase.kind === 'error' ? <p className="mt-2 text-xs text-danger">{phase.message}</p> : null}
          {phase.kind === 'partial' ? (
            <p className="mt-2 text-xs text-fg-muted">
              Pengaturan terbawa, kecuali {phase.skipped} item yang terlalu besar.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setHidden(true)}
          disabled={working}
          aria-label="Sembunyikan"
          className="min-h-tap min-w-tap shrink-0 text-fg-faint disabled:opacity-60"
        >
          <IconClose />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 pl-8">
        {phase.kind === 'partial' ? (
          <a href={href} className="inline-flex min-h-tap items-center rounded-lg bg-accent px-3 font-medium text-on-accent">
            Buka {host}
          </a>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void carry()}
              disabled={working}
              className="min-h-tap rounded-lg bg-accent px-3 font-medium text-on-accent disabled:opacity-60"
            >
              {working ? phase.step : user ? 'Bawa pengaturan & buka' : `Buka ${host}`}
            </button>
            {user && !working ? (
              <a href={href} className="inline-flex min-h-tap items-center px-2 text-fg-muted underline">
                Buka tanpa membawa
              </a>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function dayLabel(ms: number): string {
  if (!ms) return '';
  const date = new Date(ms);
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return formatDmy(iso);
}

function hasKey(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return true; // Cannot read: never overwrite.
  }
}

function NewAddressOffer(): JSX.Element | null {
  const uid = useSession((state) => (state.status === 'signed-in' ? (state.user?.uid ?? null) : null));
  const [entries, setEntries] = useState<MoveEntry[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid) return undefined;
    let live = true;
    const self = getDeviceId();
    readMoveEntries(uid)
      .then((found) => {
        if (live) setEntries(found.filter((entry) => entry.deviceId !== self));
      })
      .catch(() => {
        // Offline or refused: offer again next time the app opens.
      });
    return () => {
      live = false;
    };
  }, [uid]);

  if (!uid || entries.length === 0) return null;

  const apply = async (entry: MoveEntry): Promise<void> => {
    setBusy(true);
    for (const [key, value] of planApply(entry.json, hasKey)) {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Storage full or blocked: keep the rest.
      }
    }
    try {
      await removeMoveEntries(uid, [entry.deviceId], entries.length - 1);
    } catch {
      // Left in the account; applying it again writes nothing new.
    }
    // Stores read their settings at start-up.
    window.location.reload();
  };

  const ignore = async (): Promise<void> => {
    setBusy(true);
    try {
      await removeMoveEntries(
        uid,
        entries.map((entry) => entry.deviceId),
        0,
      );
    } catch {
      // Offered again next time; nothing lost either way.
    }
    setEntries([]);
    setBusy(false);
  };

  return (
    <div role="status" className="mx-3 my-3 rounded-xl border border-border bg-bg-subtle px-4 py-3 text-sm">
      <p className="font-medium">Pengaturan dari alamat lama ditemukan</p>
      <p className="mt-0.5 text-xs text-fg-muted">
        Tema, sticker, coretan, nilai rujukan dan urutan board dari perangkat lama. Yang sudah ada di sini tidak
        diganti.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {entries.map((entry) => (
          <button
            key={entry.deviceId}
            type="button"
            onClick={() => void apply(entry)}
            disabled={busy}
            className="min-h-tap rounded-lg bg-accent px-3 font-medium text-on-accent disabled:opacity-60"
          >
            Pakai ({[entry.label, dayLabel(entry.at)].filter(Boolean).join(' · ')})
          </button>
        ))}
        <button
          type="button"
          onClick={() => void ignore()}
          disabled={busy}
          className="min-h-tap px-2 text-fg-muted underline disabled:opacity-60"
        >
          Abaikan
        </button>
      </div>
    </div>
  );
}
