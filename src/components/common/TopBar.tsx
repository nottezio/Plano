import { IconSearch } from './Icons';
import { SyncPill } from './SyncPill';

/**
 * SPEC 11.1 — search, sync pill, avatar.
 * Search is inert in P0; F10 (client-side, offline, debounced 150 ms) lands
 * with the board in P4.
 */
export function TopBar({ title }: { title: string }): JSX.Element {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3">
        <h1 className="mr-auto truncate text-lg font-semibold tracking-tight">{title}</h1>
        <SyncPill />
        <button
          type="button"
          aria-label="Cari"
          disabled
          className="min-h-tap min-w-tap flex items-center justify-center rounded-lg text-fg-muted disabled:opacity-40"
        >
          <IconSearch />
        </button>
      </div>
    </header>
  );
}
