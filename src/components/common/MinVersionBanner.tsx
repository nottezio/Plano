import { useEffect, useState } from 'react';

import { checkForUpdate, onUpdateState, type UpdateState } from '@/pwa';
import { APP_VERSION } from '@/version.js';
import { IconRefresh } from './Icons';

const STATUS: Partial<Record<UpdateState, string>> = {
  checking: 'Memeriksa…',
  downloading: 'Versi baru ditemukan, sedang diunduh…',
  current: 'Versi terbaru yang tersedia belum mencapai batas ini. Coba lagi nanti.',
  error: 'Tidak bisa memeriksa (offline?).',
};

/**
 * The admin set a minimum version (`config/access.minVersion`) and this app is
 * older. A nudge, never a block: the note in front of a resident stays usable,
 * offline included.
 *
 * It looks for the update itself once, then hands over to `UpdateBanner` the
 * moment a new version is ready (same screen slot, so the two never stack).
 */
export function MinVersionBanner({ minimum }: { minimum: string }): JSX.Element | null {
  const [update, setUpdate] = useState<UpdateState>('idle');

  useEffect(() => onUpdateState(setUpdate), []);
  useEffect(() => {
    void checkForUpdate();
  }, [minimum]);

  if (update === 'available' || update === 'applying') return null;
  const busy = update === 'checking' || update === 'downloading';

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-50 flex items-center gap-3 rounded-xl border border-[var(--warn-strong)] bg-surface-raised px-4 py-3 shadow-pop sm:bottom-4 sm:left-auto sm:right-4 sm:w-96"
    >
      <IconRefresh className="shrink-0 text-accent" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">Perbarui Plano</p>
        <p className="text-xs text-fg-muted">
          {STATUS[update] ??
            `Versi ini (v${APP_VERSION}) lebih lama dari batas minimum (v${minimum}). Catatan Anda aman dan tetap bisa dipakai.`}
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void checkForUpdate(true)}
        className="min-h-tap shrink-0 rounded-lg bg-accent px-3 text-sm font-medium text-on-accent disabled:opacity-60"
      >
        Periksa
      </button>
    </div>
  );
}
