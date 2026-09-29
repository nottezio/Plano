import { useEffect, useState } from 'react';
import { applyUpdate, checkForUpdate, onUpdateState, type UpdateState } from '@/pwa';
import { cleanReload } from '@/lib/cleanReload';
import { useUI } from '@/store/useUI';

const STATUS: Record<UpdateState, string> = {
  idle: '',
  checking: 'Memeriksa…',
  downloading: 'Versi baru ditemukan, sedang diunduh…',
  current: 'Sudah versi terbaru.',
  available: 'Versi baru siap dipasang.',
  applying: 'Memasang versi baru…',
  error: 'Tidak bisa memeriksa (offline?).',
};

/**
 * Settings → Tentang: check for a new version on demand, and the phone's
 * Ctrl+Shift+R ("Muat ulang bersih") for when the app seems stuck on an old
 * version. Both save open editors first.
 */
export function UpdateControls(): JSX.Element {
  const [update, setUpdate] = useState<UpdateState>('idle');
  const flushAll = useUI((state) => state.flushAll);
  const hasUnsavedWork = useUI((state) => state.hasUnsavedWork);
  const [confirmClean, setConfirmClean] = useState(false);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => onUpdateState(setUpdate), []);

  const afterSaving = (action: () => void): void => {
    if (!hasUnsavedWork()) {
      action();
      return;
    }
    flushAll();
    window.setTimeout(action, 300);
  };

  const busy = update === 'checking' || update === 'applying';

  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-2">
        {update === 'available' || update === 'applying' ? (
          <button
            type="button"
            disabled={update === 'applying'}
            onClick={() => afterSaving(() => void applyUpdate())}
            className="min-h-tap flex-1 rounded-lg bg-accent px-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {update === 'applying' ? 'Memuat…' : 'Pasang versi baru'}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || update === 'downloading'}
            onClick={() => void checkForUpdate(true)}
            className="min-h-tap flex-1 rounded-lg border border-border px-3 text-sm disabled:opacity-60"
          >
            Periksa pembaruan
          </button>
        )}
        <button
          type="button"
          onClick={() => setConfirmClean((value) => !value)}
          className="min-h-tap flex-1 rounded-lg border border-border px-3 text-sm"
        >
          Muat ulang bersih
        </button>
      </div>
      {STATUS[update] ? (
        <p role="status" className="text-xs text-fg-muted">
          {STATUS[update]}
        </p>
      ) : null}
      {confirmClean ? (
        <div className="rounded-lg border border-border p-3 text-xs text-fg-muted">
          <p>
            Sama dengan Ctrl+Shift+R di laptop: kode aplikasi diunduh ulang dari server. Catatan
            dan antrean sinkronisasi tidak dihapus. Butuh koneksi internet.
          </p>
          <button
            type="button"
            onClick={() =>
              afterSaving(
                () =>
                  void cleanReload().then((ok) => {
                    if (!ok) setUnreachable(true);
                  }),
              )
            }
            className="mt-2 min-h-tap w-full rounded-lg bg-accent px-3 text-sm font-medium text-white"
          >
            Muat ulang bersih sekarang
          </button>
          {unreachable ? (
            <p role="alert" className="mt-2 text-danger">
              Server tidak terjangkau. Tidak ada yang dihapus; coba lagi saat ada sinyal.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
