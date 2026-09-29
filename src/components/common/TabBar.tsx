import { useState } from 'react';
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
  IconDocuments,
  IconMore,
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
  // A tool, not a primary tab: it is opened once a day at most, on the evening
  // before a jaga, and the four primary tabs are the ones touched on every
  // round. `wip` marks it in the rail until Avicenna says it is finished —
  // a half-built feature that looks finished is one that gets relied on.
  { to: '/helper', label: 'Helper', Icon: IconChecklist, wip: true },
  { to: '/pengaturan', label: 'Pengaturan', Icon: IconSettings },
] as const;

const TABS = [
  { to: '/', label: 'Aktif', Icon: IconBoard, end: true },
  { to: '/arsip', label: 'Arsip', Icon: IconArchive, end: false },
  { to: '/dokumen', label: 'Dokumen', Icon: IconDocuments, end: false },
] as const;

export function TabBar(): JSX.Element {
  const hint = useUI((state) => state.dpjpHint);
  const hasClipboard = useClipboardNote((state) => state.last !== null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // The disclosure has to show the accent when the open screen is one of the
  // tools, or the phone bar says nothing is selected while a tool is on screen.
  const toolActive = TOOL_TABS.some((tab) => tab.to === pathname);

  return (
    <nav
      aria-label="Navigasi utama"
      className={[
        // phone: fixed bottom bar, clearing the home indicator
        'fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface',
        'pb-[env(safe-area-inset-bottom)]',
        // tablet/desktop: static left rail
        'sm:static sm:h-full sm:w-[76px] sm:flex-col sm:gap-0.5 sm:overflow-y-auto sm:border-r sm:border-t-0 sm:py-2',
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

      {/*
        Tools. A disclosure on phone, an inline block on the rail.

        This USED TO BE one `flex shrink-0` row of four labelled links inside
        the phone bar, which is what the note above says it should not be. The
        container refused to shrink and had no `min-w-0`, so its width was the
        intrinsic width of "CatatanKalkulatorChecklistPengaturan" — four labels
        that cannot truncate — and it overflowed the viewport. Seven targets in
        a 360 px bar left about 51 px each: legal by the tap-target check, and
        unreadable.

        The rail (>=640 px) is a column with room for all four, so it keeps
        them inline. Only the phone bar gets the extra tap the note describes.
      */}
      <button
        type="button"
        onClick={() => setToolsOpen(true)}
        aria-label="Alat lainnya"
        aria-expanded={toolsOpen}
        className={[
          'flex min-h-tap flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px]',
          'sm:hidden',
          toolActive ? 'text-accent' : 'text-fg-faint',
        ].join(' ')}
      >
        <IconMore strokeWidth={toolActive ? 2.1 : 1.75} />
        <span className={toolActive ? 'font-medium' : undefined}>Lainnya</span>
      </button>

      <div
        className={[
          'hidden shrink-0 sm:flex',
          'sm:mt-1 sm:w-full sm:flex-col sm:gap-0.5 sm:border-t sm:border-border sm:pt-1',
        ].join(' ')}
      >
        {TOOL_TABS.map(({ to, label, Icon, ...rest }) => (
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
            <span className="text-[10px] sm:hidden lg:inline lg:text-xs">
              {label}
              {'wip' in rest && rest.wip ? (
                <span className="ml-1 align-top text-[8px] text-danger">WIP</span>
              ) : null}
            </span>
          </NavLink>
        ))}
      </div>

      {/*
        Full-width rows, not a grid of icons.

        The sheet exists because four labels did not fit across a phone bar;
        laying them out in a 2×2 grid inside it would reproduce the same
        squeeze one level down.
      */}
      <Sheet
        open={toolsOpen}
        onOpenChange={setToolsOpen}
        title="Alat"
        description="Catatan lepas, kalkulator, checklist, dan pengaturan."
      >
        <div className="flex flex-col p-2">
          {TOOL_TABS.map(({ to, label, Icon, ...rest }) => {
            const active = pathname === to;
            return (
              <button
                key={to}
                type="button"
                onClick={() => {
                  setToolsOpen(false);
                  navigate(to);
                }}
                className={[
                  'flex min-h-tap items-center gap-3 rounded-lg px-3 py-2 text-left text-sm',
                  active ? 'bg-bg-subtle font-medium text-accent' : 'text-fg',
                ].join(' ')}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  {label}
                  {'wip' in rest && rest.wip ? (
                    <span className="ml-1 text-[9px] text-danger">WIP</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </Sheet>

      {/*
        THE CONTEXT DOCK, desktop only: one card for the ambient facts about
        what is open (the DPJP's reporting format, what was last copied), then
        one line of status.

        These used to be three separately boxed blocks stacked under the nav
        (DPJP box, clipboard box, sync pill) plus a two-line footer. On a
        patient page with a clipboard entry they took more height than the
        navigation above them. One card with compact rows, and sync + version
        on a single line, keep the rail's bottom a fixed, small size.
      */}
      <div className="mt-auto hidden lg:block">
        {hint || hasClipboard ? (
          <div className="mx-0 mb-2 space-y-0.5 rounded-lg border border-border bg-bg-subtle p-1">
            {hint ? (
              <div
                title={`${hint.name}${hint.poli ? ` · Poli ${hint.poli}` : ''}${hint.poliAfter ? ` · lalu ${hint.poliAfter}` : ''}`}
                className="px-1.5 py-1 text-[11px] leading-tight"
              >
                <p className="truncate font-medium">
                  <span className="mr-1 rounded bg-surface px-1 text-[10px] font-semibold text-fg-muted">DPJP</span>
                  {hint.initials}
                  <span className="ml-1 font-normal text-fg-muted">{hint.description}</span>
                </p>
                {hint.poli ? (
                  <p className="mt-0.5 truncate text-fg-muted">
                    Poli {hint.poli}
                    {hint.poliAfter ? <span className="text-fg-faint"> · lalu {hint.poliAfter}</span> : null}
                  </p>
                ) : null}
              </div>
            ) : null}
            {hint && hasClipboard ? <div className="mx-1.5 h-px bg-border" /> : null}
            <ClipboardPill variant="row" />
          </div>
        ) : null}

        <div
          title={`© Avicenna · v${APP_VERSION}`}
          className="flex items-center gap-2 px-1 pb-1 text-[11px] text-fg-faint"
        >
          <SyncPill compact />
          <span className="ml-auto truncate font-mono">v{APP_VERSION}</span>
        </div>
      </div>
    </nav>
  );
}
