import { NavLink } from 'react-router-dom';

import { APP_VERSION } from '@/version.js';
import { IconArchive, IconBoard, IconDocuments, IconSettings } from './Icons';

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
  { to: '/pengaturan', label: 'Pengaturan', Icon: IconSettings, end: false },
] as const;

export function TabBar(): JSX.Element {
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
      <p className="mt-auto hidden px-3 pb-1 text-[11px] leading-relaxed text-fg-faint lg:block">
        © Avicenna
        <br />
        <span className="font-mono">v{APP_VERSION}</span>
      </p>
    </nav>
  );
}
