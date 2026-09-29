import { useUI } from '@/store/useUI';

/**
 * SPEC 7.4 — Tersinkron / Menyimpan… / Offline — N perubahan tertunda.
 * In P0 the state is static; P1 drives it from Firestore snapshot metadata
 * (`hasPendingWrites`) plus `navigator.onLine`.
 */
export function SyncPill({ compact = false }: { compact?: boolean }): JSX.Element {
  const sync = useUI((state) => state.sync);

  const { label, tone } =
    sync.kind === 'saving'
      ? { label: 'Menyimpan…', tone: 'text-fg-muted' }
      : sync.kind === 'offline'
        ? {
            label: `Offline — ${sync.pending} perubahan tertunda`,
            tone: 'text-[var(--card-step-2-accent)]',
          }
        : { label: 'Tersinkron', tone: 'text-fg-faint' };

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
        <span className="truncate">{sync.kind === 'offline' ? `Offline · ${sync.pending} tertunda` : label}</span>
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
