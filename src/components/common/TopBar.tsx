import type { ReactNode } from 'react';

import { SyncPill } from './SyncPill';

/**
 * SPEC 11.1 — page title and sync state.
 *
 * The search icon that used to live here was a P0 stub: permanently `disabled`,
 * never wired to anything, and sitting directly above the board's real search
 * field. Two search affordances where only one works is worse than one, so it
 * is gone rather than hooked up — the field below it is already the answer.
 */
export function TopBar({ title, badge }: { title: string; badge?: ReactNode }): JSX.Element {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      {/* 48 px, not 56 (2026-10-08 mobile revamp): it is a label and a status
          dot's worth of information, on every screen. */}
      <div className="flex min-h-12 items-center gap-2 px-4 py-1.5 lg:py-2">
        {/* From lg the sidebar already shows which section is open, so the
            title here is duplication taking up a whole row. */}
        <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight lg:hidden">
          {title}
        </h1>
        {badge ? <span className="shrink-0 lg:hidden">{badge}</span> : null}
        <span className="mr-auto" />
        <SyncPill />
      </div>
    </header>
  );
}
