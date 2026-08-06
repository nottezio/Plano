import { NavLink } from 'react-router-dom';
import { IconArchive, IconBoard, IconDocuments, IconSettings } from './Icons';

/**
 * SPEC 11.1 / 11.2 — bottom tab bar on phone, left rail from 640 px up.
 * One component, two layouts: the alternative (two components) drifts.
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
      ].join(' ')}
    >
      {TABS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            [
              'flex min-h-tap flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px]',
              'sm:flex-none sm:rounded-lg sm:py-3',
              isActive ? 'text-accent' : 'text-fg-faint',
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
    </nav>
  );
}
