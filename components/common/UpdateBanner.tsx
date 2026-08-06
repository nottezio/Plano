import { useEffect, useState } from 'react';
import { applyUpdate, onUpdateAvailable } from '@/pwa';
import { useUI } from '@/store/useUI';
import { IconRefresh } from './Icons';

/**
 * SPEC 17 — "Versi baru tersedia — Muat ulang".
 *
 * The reload is gated on `hasUnsavedWork()`. A new service worker sitting in
 * `waiting` is never a reason to discard keystrokes taken at a bedside, so if
 * an editor is dirty the banner explains itself and stays put instead of
 * reloading.
 */
export function UpdateBanner(): JSX.Element | null {
  const [available, setAvailable] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const hasUnsavedWork = useUI((state) => state.hasUnsavedWork);

  useEffect(() => onUpdateAvailable(setAvailable), []);

  if (!available) return null;

  const onReload = (): void => {
    if (hasUnsavedWork()) {
      setBlocked(true);
      return;
    }
    void applyUpdate();
  };

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-50 flex items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3 shadow-lg sm:bottom-4 sm:left-auto sm:right-4 sm:w-96"
    >
      <IconRefresh className="shrink-0 text-accent" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">Versi baru tersedia</p>
        {blocked ? (
          <p className="text-xs text-fg-muted">
            Catatan belum tersimpan. Simpan dulu, lalu muat ulang.
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onReload}
        className="min-h-tap shrink-0 rounded-lg bg-accent px-3 text-sm font-medium text-white"
      >
        Muat ulang
      </button>
    </div>
  );
}
