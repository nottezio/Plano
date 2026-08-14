import { NavLink } from 'react-router-dom';

import { SyncPill } from './SyncPill';
import { APP_VERSION } from '@/version.js';
import { IconArchive, IconBoard, IconDocuments, IconNote, IconSettings } from './Icons';
import { useUI } from '@/store/useUI';

/**
 * SPEC 11.1 / 11.2 — three layouts, one component:
 *   phone  (<640)  bottom tab bar
 *   tablet (>=640) 76 px icon rail
 *   desktop(>=1024) 224 px sidebar with labels beside the icons
 *
 * The desktop tier exists because a 76 px icon rail on a 27" monitor is what
 * makes a web app feel like a stretched phone build. Two components would
 * drift; three breakpoints on one component cannot.
 */
const TABS = [
  { to: '/', label: 'Aktif', Icon: IconBoard, end: true },
  { to: '/arsip', label: 'Arsip', Icon: IconArchive, end: false },
  { to: '/dokumen', label: 'Dokumen', Icon: IconDocuments, end: false },
  { to: '/catatan', label: 'Catatan', Icon: IconNote, end: false },
  { to: '/pengaturan', label: 'Pengaturan', Icon: IconSettings, end: false },
] as const;

export function TabBar(): JSX.Element {
  const hint = useUI((state) => state.dpjpHint);

  return (
    <nav
      aria-label="Navigasi utama"
      className={[
        // phone: fixed bottom bar, clearing the home indicator
        'fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface',
        'pb-[env(safe-area-inset-bottom)]',
        // tablet/desktop: static left rail
        'sm:static sm:h-full sm:w-[76px] sm:flex-col sm:gap-1 sm:border-r sm:border-t-0 sm:py-4',
        'lg:w-[224px] lg:items-stretch lg:px-3',
      ].join(' ')}
    >
      {/* Wordmark only where there is room for it. */}
      <span className="hidden lg:mb-3 lg:block lg:px-3 lg:text-lg lg:font-semibold lg:tracking-tight">
        Plano
      </span>

      {TABS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            [
              'flex min-h-tap flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px]',
              'sm:flex-none sm:rounded-lg sm:py-3',
              // Desktop: horizontal, left-aligned, readable label.
              'lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm',
              isActive ? 'text-accent lg:bg-bg-subtle' : 'text-fg-faint',
            ].join(' ')
          }
        >
          {({ isActive }) => (
            <>
              <Icon strokeWidth={isActive ? 2.1 : 1.75} />
              <span className={isActive ? 'font-medium' : undefined}>{label}</span>
            </>
          )}
        </NavLink>
      ))}

      {/* Desktop only: the sidebar has dead space at the bottom, and a footer
          under the content pushed the empty state off-centre. On phone the tab
          bar is 64 px of thumb target — nothing else belongs in it. */}
      {/*
        Reporting format for the patient currently open.

        Bottom of the rail, above the sync pill: it is a reminder you glance at
        before copying, not something to act on, so it belongs in the furniture
        rather than over the note. Desktop only — on phone the rail is 64 px of
        thumb target, and the patient page already shows the same line under the
        date.
      */}
      {hint ? (
        <div
          title={hint.name}
          className="mx-3 mb-2 mt-auto hidden rounded-lg border border-border bg-bg-subtle p-2 lg:block"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-faint">
            Format laporan
          </p>
          <p className="mt-0.5 text-xs font-medium">{hint.initials}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">{hint.description}</p>
        </div>
      ) : null}

      {/* Sync state lives here on desktop: it is ambient status, not an action,
          so it belongs with the other ambient furniture rather than in a bar of
          its own across the top of the content. */}
      <div className={`${hint ? '' : 'mt-auto '}hidden px-3 pb-2 lg:block`}>
        <SyncPill />
      </div>

      <p className="hidden px-3 pb-1 text-[11px] leading-relaxed text-fg-faint lg:block">
        © Avicenna
        <br />
        <span className="font-mono">v{APP_VERSION}</span>
      </p>
    </nav>
  );
}
