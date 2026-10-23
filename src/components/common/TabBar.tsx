import { useState, type ComponentType, type SVGProps } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

import { Sheet } from './Sheet';
import { SyncPill } from './SyncPill';
import { APP_VERSION } from '@/version.js';
import { ClipboardPill } from './ClipboardPill';
import { useClipboardNote } from '@/store/useClipboardNote';
import {
  IconArchive,
  IconBoard,
  IconCalculator,
  IconChecklist,
  IconClipboard,
  IconDocuments,
  IconMore,
  IconNote,
  IconSettings,
} from './Icons';

/**
 * SPEC 11.1 / 11.2: three layouts, one component.
 *   phone   (<640)   bottom tab bar
 *   tablet  (>=640)  76 px icon rail
 *   desktop (>=1024) 232 px sidebar, labels beside the icons
 *
 * REVAMP (2026-10-05). The sidebar had grown two vocabularies: the three ward
 * destinations were 14 px rows with a grey "selected" fill, the tools were
 * 12 px rows with only a blue label, Helper borrowed Checklist's icon, and the
 * owner's name had been cut to a tooltip on the version. Now:
 *  - one row style for every destination, grouped under "Bangsal" and "Fitur";
 *  - one "selected" look everywhere: the accent pill (rail, phone bar) or the
 *    accent row with a side bar (sidebar);
 *  - Pengaturan at the foot, beside the status it configures;
 *  - "© Avicenna · v…" written out again (SPEC 11.1), not hidden in a title.
 *
 * Seven destinations do not fit a phone bar, so the phone keeps the split by
 * how often each is opened: the three ward screens on the bar, the tools one
 * tap away in "Lainnya". The rail and sidebar have room for all of them.
 */

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

interface Destination {
  to: string;
  label: string;
  Icon: Icon;
  end?: boolean;
  /** Marked until Avicenna says it is finished: a half-built feature that looks finished gets relied on. */
  wip?: boolean;
}

const WARD: readonly Destination[] = [
  { to: '/', label: 'Aktif', Icon: IconBoard, end: true },
  { to: '/arsip', label: 'Arsip', Icon: IconArchive },
  { to: '/dokumen', label: 'Dokumen', Icon: IconDocuments },
];

const TOOLS: readonly Destination[] = [
  { to: '/catatan', label: 'Catatan', Icon: IconNote },
  { to: '/kalkulator', label: 'Kalkulator', Icon: IconCalculator },
  { to: '/checklist', label: 'Checklist', Icon: IconChecklist },
  { to: '/helper', label: 'Helper', Icon: IconClipboard, wip: true },
  { to: '/list', label: 'List Maker', Icon: IconBoard, wip: true },
];

const SETTINGS: Destination = { to: '/pengaturan', label: 'Pengaturan', Icon: IconSettings };

/** Everything behind "Lainnya" on a phone. */
const MORE: readonly Destination[] = [...TOOLS, SETTINGS];

function WipTag({ className = '' }: { className?: string }): JSX.Element {
  return (
    <span
      className={`rounded-full bg-[var(--danger-soft)] px-1.5 text-[10px] font-semibold leading-4 text-danger ${className}`}
    >
      WIP
    </span>
  );
}

/**
 * One destination, in all three layouts.
 *
 * Below `lg` the icon sits in a pill that fills with the accent when active
 * (the rail's and the phone bar's selection mark). From `lg` the pill dissolves
 * and the whole row carries the selection instead.
 */
function NavItem({ item, phone = false }: { item: Destination; phone?: boolean }): JSX.Element {
  const { to, label, Icon, end, wip } = item;
  return (
    <NavLink
      to={to}
      end={end ?? false}
      className={({ isActive }) =>
        [
          'group relative flex min-h-tap flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-xs outline-none sm:text-[11px]',
          'focus-visible:ring-2 focus-visible:ring-accent',
          phone ? 'flex-1' : 'hidden sm:flex sm:w-full sm:rounded-xl',
          // Desktop: a row.
          'lg:flex-row lg:justify-start lg:gap-3 lg:rounded-lg lg:px-2.5 lg:py-0 lg:text-[13px] [@media(pointer:fine)]:lg:min-h-9',
          isActive
            ? 'text-accent lg:bg-[var(--accent-soft)] lg:font-medium'
            : 'text-fg-muted hover:text-fg lg:hover:bg-bg-subtle',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          {/* The side bar marking the active row, desktop only. */}
          <span
            aria-hidden="true"
            className={[
              'absolute left-0 top-1/2 hidden h-4 w-[3px] -translate-y-1/2 rounded-full bg-accent',
              isActive ? 'lg:block' : '',
            ].join(' ')}
          />
          <span
            className={[
              'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
              'lg:h-auto lg:w-auto lg:bg-transparent',
              isActive ? 'bg-[var(--accent-soft)]' : 'group-hover:bg-bg-subtle lg:group-hover:bg-transparent',
            ].join(' ')}
          >
            <Icon width={20} height={20} strokeWidth={isActive ? 2.1 : 1.75} />
          </span>
          <span className={`max-w-full truncate leading-tight lg:flex-1 ${isActive ? 'font-medium' : ''}`}>
            {label}
          </span>
          {wip ? (
            <>
              {/* Rail and phone: a dot on the icon. Sidebar: the word. */}
              <span
                aria-hidden="true"
                className="absolute right-[calc(50%-1.5rem)] top-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-surface lg:hidden"
              />
              <WipTag className="hidden lg:inline" />
            </>
          ) : null}
        </>
      )}
    </NavLink>
  );
}

function GroupLabel({ children }: { children: string }): JSX.Element {
  return (
    <p className="hidden px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-fg-faint lg:block">
      {children}
    </p>
  );
}

export function TabBar(): JSX.Element {
  const hasClipboard = useClipboardNote((state) => state.last !== null);
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // "Lainnya" shows the accent while one of its screens is open, or the phone
  // bar would say nothing is selected while a tool is on screen.
  const moreActive = MORE.some((item) => item.to === pathname);

  return (
    <nav
      aria-label="Navigasi utama"
      className={[
        // phone: fixed bottom bar, clearing the home indicator
        'fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface',
        'pb-[env(safe-area-inset-bottom)]',
        // tablet: static icon rail
        'sm:static sm:h-full sm:w-[76px] sm:flex-col sm:items-stretch sm:gap-0.5 sm:overflow-y-auto sm:border-r sm:border-t-0 sm:px-1.5 sm:py-3',
        // desktop: labelled sidebar
        'lg:w-[232px] lg:px-3',
      ].join(' ')}
    >
      {/* Brand: a mark on the rail, mark and name on the sidebar. */}
      <div className="hidden items-center gap-2.5 px-1 pb-2 sm:flex sm:justify-center lg:justify-start lg:px-2.5 lg:pb-1">
        <img
          src={`${import.meta.env.BASE_URL}icons/icon-192.png`}
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 rounded-lg shadow-card ring-1 ring-border"
        />
        <span className="hidden text-[15px] font-semibold tracking-tight lg:inline">Plano</span>
      </div>

      {/* Phone bar: the three ward screens and "Lainnya". */}
      <div className="flex flex-1 sm:hidden">
        {WARD.map((item) => (
          <NavItem key={item.to} item={item} phone />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="Menu lainnya"
          aria-expanded={moreOpen}
          className={[
            'flex min-h-tap flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-xs',
            moreActive ? 'text-accent' : 'text-fg-muted',
          ].join(' ')}
        >
          <span
            className={`flex h-7 w-12 items-center justify-center rounded-full ${moreActive ? 'bg-[var(--accent-soft)]' : ''}`}
          >
            <IconMore width={20} height={20} strokeWidth={moreActive ? 2.1 : 1.75} />
          </span>
          <span className={moreActive ? 'font-medium' : undefined}>Lainnya</span>
        </button>
      </div>

      {/* Rail and sidebar: every destination, grouped. */}
      <GroupLabel>Bangsal</GroupLabel>
      {WARD.map((item) => (
        <NavItem key={item.to} item={item} />
      ))}
      <div aria-hidden="true" className="mx-2 my-1.5 hidden h-px bg-border sm:block lg:hidden" />
      <GroupLabel>Fitur</GroupLabel>
      {TOOLS.map((item) => (
        <NavItem key={item.to} item={item} />
      ))}

      <div className="mt-auto hidden pt-2 sm:block">
        {/*
          THE CONTEXT DOCK, desktop only: what was last copied. The DPJP card
          that used to sit here (12.12 and before) repeated the DPJP line the
          patient page already shows — above the note, or in its side panel —
          so it was removed (Avi, 12-12).
        */}
        {hasClipboard ? (
          <div className="mb-2 hidden rounded-xl border border-border bg-bg-subtle p-1 lg:block">
            <ClipboardPill variant="row" />
          </div>
        ) : null}

        <NavItem item={SETTINGS} />

        {/* Status and credit. The rail is too narrow for either. */}
        <div className="mt-2 hidden border-t border-border px-2.5 pt-2 text-xs lg:block">
          <SyncPill compact />
          <p className="mt-1 truncate text-fg-faint">
            © Avicenna <span aria-hidden="true">·</span>{' '}
            <span title="Versi aplikasi" className="font-mono">
              v{APP_VERSION}
            </span>
          </p>
        </div>
      </div>

      {/*
        Full-width rows, not a grid of icons: the sheet exists because four
        labels did not fit across a phone bar, and a 2×2 grid inside it would
        reproduce the same squeeze one level down.
      */}
      <Sheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        title="Lainnya"
        description="Catatan lepas, kalkulator, checklist, Helper, dan pengaturan."
      >
        <div className="flex flex-col p-2">
          {MORE.map(({ to, label, Icon, wip }) => {
            const active = pathname === to;
            return (
              <button
                key={to}
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  navigate(to);
                }}
                className={[
                  'flex min-h-tap items-center gap-3 rounded-xl px-3 py-2 text-left text-sm',
                  active ? 'bg-[var(--accent-soft)] font-medium text-accent' : 'text-fg',
                ].join(' ')}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {wip ? <WipTag /> : null}
              </button>
            );
          })}
        </div>
      </Sheet>
    </nav>
  );
}
