import { useState } from 'react';

import { acknowledgeWriteFailures } from '@/data/syncStatus';
import { useUI, type SyncState } from '@/store/useUI';

import { Sheet } from './Sheet';
import { Button } from './ui';

/**
 * SPEC 7.4 — Tersinkron / Menyimpan… / Offline — N perubahan tertunda.
 * In P0 the state is static; P1 drives it from Firestore snapshot metadata
 * (`hasPendingWrites`) plus `navigator.onLine`.
 */
export function SyncPill({
  compact = false,
  dot = false,
}: {
  compact?: boolean;
  /**
   * A bare dot for a crowded header (the phone patient page). Synced and
   * saving are a dot only; offline keeps its word, because "your writes have
   * not left this phone" is the one state that must be read, not inferred.
   */
  dot?: boolean;
}): JSX.Element {
  const sync = useUI((state) => state.sync);

  if (sync.kind === 'error') return <FailedPill sync={sync} variant={dot ? 'dot' : compact ? 'compact' : 'full'} />;

  if (dot) {
    const offline = sync.kind === 'offline';
    return (
      <span
        role="status"
        aria-live="polite"
        title={offline ? `Offline — ${sync.pending} perubahan pending` : sync.kind === 'saving' ? 'Menyimpan…' : 'Synced'}
        className={[
          'flex shrink-0 items-center gap-1 text-xs font-medium',
          offline ? 'rounded-full border border-current px-2 py-0.5 text-[var(--card-step-2-accent)]' : 'px-1',
        ].join(' ')}
      >
        <span
          aria-hidden="true"
          className={[
            'h-2 w-2 rounded-full',
            offline ? 'bg-current' : sync.kind === 'saving' ? 'animate-pulse bg-accent' : 'bg-[var(--card-done-accent)]',
          ].join(' ')}
        />
        {offline ? <span>Offline · {sync.pending}</span> : <span className="sr-only">{sync.kind === 'saving' ? 'Menyimpan…' : 'Synced'}</span>}
      </span>
    );
  }

  const { label, tone } =
    sync.kind === 'saving'
      ? { label: 'Menyimpan…', tone: 'text-fg-muted' }
      : sync.kind === 'offline'
        ? {
            label: `Offline — ${sync.pending} perubahan pending`,
            tone: 'text-[var(--card-step-2-accent)]',
          }
        : // Muted, not faint: faint is 3:1 on the canvas, and this is status, not decoration.
          { label: 'Synced', tone: 'text-fg-muted' };

  if (compact) {
    // A dot and a word, for the sidebar's single status line.
    const dot =
      sync.kind === 'offline'
        ? 'bg-[var(--card-step-2-accent)]'
        : sync.kind === 'saving'
          ? 'bg-accent'
          : 'bg-[var(--fg-faint)]';
    return (
      <span role="status" aria-live="polite" className={`flex min-w-0 items-center gap-1.5 ${tone}`}>
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <span className="truncate">{sync.kind === 'offline' ? `Offline · ${sync.pending} pending` : label}</span>
      </span>
    );
  }

  return (
    <span
      role="status"
      aria-live="polite"
      className={`whitespace-nowrap rounded-full border border-border px-2.5 py-1 text-xs ${tone}`}
    >
      {label}
    </span>
  );
}

/**
 * What a refusal code means for the person holding the phone.
 *
 * Only the codes a write can realistically meet. Anything else names its code
 * so a screenshot sent to the admin page says what happened.
 */
function failureReason(code: string | undefined): string {
  switch (code) {
    case 'permission-denied':
      return 'Server menolak karena izin akses. Biasanya aturan server belum diperbarui, atau pasien atau list ini sudah bukan milik Anda.';
    case 'resource-exhausted':
      return 'Kuota server sedang habis. Coba lagi beberapa saat lagi.';
    case 'unauthenticated':
      return 'Sesi masuk sudah berakhir. Keluar lalu masuk lagi.';
    case undefined:
      return 'Server menolak tanpa kode.';
    default:
      return `Server menolak (kode ${code}).`;
  }
}

/**
 * The refused state: red, worded, and a button.
 *
 * Never dot-only, for the same reason offline keeps its word: "your change did
 * not reach the server" must be read, not inferred from a colour. Tapping it
 * explains and is the acknowledgement; until then it stays, even after later
 * writes succeed.
 */
function FailedPill({
  sync,
  variant,
}: {
  sync: Extract<SyncState, { kind: 'error' }>;
  variant: 'dot' | 'compact' | 'full';
}): JSX.Element {
  const [open, setOpen] = useState(false);
  // The phone patient header also holds the date, Visite, Salin and the menu:
  // one word keeps the date readable, and the sheet says the rest.
  const label = variant === 'dot' ? 'Gagal' : `Gagal sinkron · ${sync.failed}`;
  const time = new Date(sync.at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return (
    // The live region wraps the button rather than sitting inside it: a
    // `status` inside a button is dropped from the button's name, which left
    // a screen reader announcing an empty button.
    <span role="status" aria-live="assertive" className={variant === 'compact' ? 'flex min-w-0' : 'flex shrink-0'}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Gagal sinkron, ${sync.failed} perubahan ditolak server. Lihat detail`}
        className={[
          'flex min-h-tap shrink-0 items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
          variant === 'compact' ? 'w-full min-w-0 justify-start' : 'justify-center',
        ].join(' ')}
      >
        <span
          aria-hidden="true"
          className={[
            'flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-danger',
            variant === 'compact' ? '' : 'rounded-full border border-current bg-surface px-2.5 py-1',
          ].join(' ')}
        >
          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-current" />
          <span className="truncate">{label}</span>
        </span>
      </button>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Perubahan ditolak server"
        description={`${sync.failed} perubahan tidak tersimpan di server. Terakhir pukul ${time}.`}
        footer={
          <Button
            variant="primary"
            full
            onClick={() => {
              acknowledgeWriteFailures();
              setOpen(false);
            }}
          >
            Mengerti
          </Button>
        }
      >
        <div className="space-y-3 text-sm leading-relaxed text-fg">
          <p>{failureReason(sync.code)}</p>
          <p>
            Perubahan yang ditolak tidak dikirim ulang otomatis. Periksa catatan atau pengaturan yang terakhir Anda ubah.
            Bila isinya masih tampil di layar, salin dulu sebelum memuat ulang aplikasi.
          </p>
          <p className="text-fg-muted">Kejadian ini tercatat di Riwayat sesi (Pengaturan), ikut terkirim bila Anda melapor.</p>
        </div>
      </Sheet>
    </span>
  );
}
