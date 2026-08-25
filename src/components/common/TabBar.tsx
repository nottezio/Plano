import { NavLink } from 'react-router-dom';

import { SyncPill } from './SyncPill';
import { APP_VERSION } from '@/version.js';
import {
  IconArchive,
  IconBoard,
  IconCalculator,
  IconChecklist,
  IconDocuments,
  IconNote,
  IconSettings,
} from './Icons';
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
/**
 * Seven destinations does not fit a phone bar or a 76px rail.
 *
 * The split is by how often each is opened, not by what they are: Aktif, Arsip
 * and Dokumen are used constantly, the four tools occasionally. Trimming the
 * primary row to four keeps every tap target full width, and the tools sit
 * behind one more tap rather than being squeezed into a column that scrolls.
 */
const TOOL_TABS = [
  { to: '/catatan', label: 'Catatan', Icon: IconNote },
  { to: '/kalkulator', label: 'Kalkulator', Icon: IconCalculator },
  { to: '/checklist', label: 'Checklist', Icon: IconChecklist },
  { to: '/pengaturan', label: 'Pengaturan', Icon: IconSettings },
] as const;

const TABS = [
  { to: '/', label: 'Aktif', Icon: IconBoard, end: true },
  { to: '/arsip', label: 'Arsip', Icon: IconArchive, end: false },
  { to: '/dokumen', label: 'Dokumen', Icon: IconDocuments, end: false },
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
        'sm:static sm:h-full sm:w-[76px] sm:flex-col sm:gap-0.5 sm:border-r sm:border-t-0 sm:py-2',
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
      {/* Tools, one row on a phone and a compact block on the rail. */}
      <div
        className={[
          'flex shrink-0',
          'sm:mt-1 sm:w-full sm:flex-col sm:gap-0.5 sm:border-t sm:border-border sm:pt-1',
        ].join(' ')}
      >
        {TOOL_TABS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            aria-label={label}
            className={({ isActive }) =>
              [
                'flex min-h-tap flex-1 flex-col items-center justify-center gap-0.5',
                'sm:w-full sm:py-1 lg:flex-row lg:justify-start lg:gap-2 lg:px-3',
                isActive ? 'text-accent' : 'text-fg-faint',
              ].join(' ')
            }
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] sm:hidden lg:inline lg:text-xs">{label}</span>
          </NavLink>
        ))}
      </div>

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
          className="mx-3 mb-2 mt-auto hidden rounded-lg border border-border bg-bg-subtle px-2 py-1.5 text-[11px] lg:block"
        >
          {/* One line per fact instead of a labelled block. The panel was
              taller than the nav it sat under, which is what made the rail feel
              crammed. */}
          <p className="font-medium">
            {hint.initials}
            <span className="ml-1 font-normal text-fg-muted">{hint.description}</span>
          </p>
          {hint.poli ? (
            <p className="mt-1 leading-snug text-fg-muted">
              Poli: {hint.poli}
              {/* The roster is a dated document — say which one, so nobody
                  reads last month's by accident. */}
              <span className="ml-1 text-fg-faint">({hint.period})</span>
            </p>
          ) : null}
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
