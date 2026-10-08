import { useUI } from '@/store/useUI';

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

  if (dot) {
    const offline = sync.kind === 'offline';
    return (
      <span
        role="status"
        aria-live="polite"
        title={offline ? `Offline — ${sync.pending} perubahan pending` : sync.kind === 'saving' ? 'Menyimpan…' : 'Synced'}
        className={[
          'flex shrink-0 items-center gap-1 text-[11px] font-medium',
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
        : { label: 'Synced', tone: 'text-fg-faint' };

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
      className={`whitespace-nowrap rounded-full border border-border px-2.5 py-1 text-[11px] ${tone}`}
    >
      {label}
    </span>
  );
}
