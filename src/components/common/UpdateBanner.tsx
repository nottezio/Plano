import { useEffect, useState } from 'react';
import { applyUpdate, onUpdateAvailable } from '@/pwa';
import { useUI } from '@/store/useUI';
import { IconRefresh } from './Icons';

/**
 * SPEC 17 — "Versi baru tersedia — Muat ulang".
 *
 * A new service worker sitting in `waiting` is never a reason to discard
 * keystrokes taken at a bedside — but refusing to reload and saying "save
 * first" was worse than useless, because saving is something the app does on a
 * timer and offers no button for. The banner appeared unclickable.
 *
 * It now force-saves every live editor, waits for those writes to be queued,
 * and then reloads. Firestore's own queue carries them to the server, so the
 * reload is safe even offline.
 */
export function UpdateBanner(): JSX.Element | null {
  const [available, setAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const hasUnsavedWork = useUI((state) => state.hasUnsavedWork);
  const flushAll = useUI((state) => state.flushAll);

  useEffect(() => onUpdateAvailable(setAvailable), []);

  if (!available) return null;

  const onReload = (): void => {
    if (!hasUnsavedWork()) {
      void applyUpdate();
      return;
    }

    setSaving(true);
    flushAll();
    // A moment for the writes to reach Firestore's queue before the document is
    // torn down. They are durable from that point, online or not.
    window.setTimeout(() => void applyUpdate(), 300);
  };

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-50 flex items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3 shadow-lg sm:bottom-4 sm:left-auto sm:right-4 sm:w-96"
    >
      <IconRefresh className="shrink-0 text-accent" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">Versi baru tersedia</p>
        <p className="text-xs text-fg-muted">
          {saving ? 'Menyimpan catatan…' : 'Catatan tersimpan otomatis sebelum muat ulang.'}
        </p>
      </div>
      <button
        type="button"
        onClick={onReload}
        disabled={saving}
        className="min-h-tap shrink-0 rounded-lg bg-accent px-3 text-sm font-medium text-white disabled:opacity-60"
      >
        {saving ? 'Menyimpan…' : 'Muat ulang'}
      </button>
    </div>
  );
}
