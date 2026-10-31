import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  activate,
  closeTab,
  cycle,
  HOME_URL,
  launch,
  moveTab,
  navigated,
  openTab,
  readTabs,
  tabLabel,
  tabTitle,
  titled,
  type TabsState,
} from '@/domain/appTabs';
import { useMediaQuery } from '@/hooks/useMediaQuery';

/**
 * Browser-like tabs for the INSTALLED app on a desktop (2026-10-16, Avi).
 * Nothing changes in a browser tab or on a phone. The model and its reasons
 * are in `domain/appTabs`.
 *
 * Where the strip sits:
 * - Window Controls Overlay on (the manifest offers it; Chrome's chevron in
 *   the title bar toggles it): IN the title bar, beside the window buttons,
 *   like a browser's own tabs. The empty part of the strip drags the window.
 * - Otherwise: a bar at the top of the window, under the system title bar.
 * Either way the app below is `--app-h` tall (100dvh minus the strip), which
 * every full-height screen uses instead of a bare 100dvh.
 *
 * Open a tab: "+" (the board), or Ctrl/⌘+click or middle-click a link in
 * the app (opened behind, as in a browser). Close: × or middle-click. Ctrl+Tab
 * and Ctrl+Shift+Tab move between tabs. The tabs are kept on this device.
 */

const STORE_KEY = 'plano.desktopTabs';
/** Strip height (2026-10-16: 36 → 44 px, Avi: "enlarge the tab"). */
const BAR_PX = 44;
/** A press that moves less than this is a click, not a drag. */
const DRAG_SLOP = 6;

function load(): TabsState | null {
  try {
    return readTabs(localStorage.getItem(STORE_KEY));
  } catch {
    return null;
  }
}

function save(state: TabsState): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    // Not kept (private window, full storage): the tabs still work this session.
  }
}

/**
 * Installed (its own window) and wide enough for a strip: a desktop with a
 * mouse, or a tablet by touch (768 px wide and 600 px tall, which keeps a phone
 * turned sideways out).
 */
export function useDesktopTabsEnabled(): boolean {
  const installed = useMediaQuery('(display-mode: standalone), (display-mode: window-controls-overlay)');
  const wide = useMediaQuery('(pointer: fine) and (min-width: 900px), (min-width: 768px) and (min-height: 600px)');
  return installed && wide;
}

const drag = { WebkitAppRegion: 'drag', appRegion: 'drag' } as CSSProperties;
const noDrag = { WebkitAppRegion: 'no-drag', appRegion: 'no-drag' } as CSSProperties;

export function DesktopTabs({ children, force = false }: { children: ReactNode; force?: boolean }): JSX.Element {
  const enabled = useDesktopTabsEnabled() || force;
  return enabled ? <TabStrip>{children}</TabStrip> : <>{children}</>;
}

function TabStrip({ children }: { children: ReactNode }): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const overlay = useMediaQuery('(display-mode: window-controls-overlay)');
  const here = `${location.pathname}${location.search}`;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  // Launched at the board: the tabs as they were; on a page a tab shows (a
  // reload): that tab; on a link from elsewhere: a new tab (`launch`).
  const [state, setState] = useState<TabsState>(() => launch(load(), here));
  const latest = useRef(state);
  latest.current = state;

  // On start, show the active tab's page.
  useEffect(() => {
    const active = latest.current.tabs.find((t) => t.id === latest.current.active);
    if (active && active.url !== here) navigate(active.url, { replace: true });
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The router moved: the active tab follows.
  useEffect(() => setState((s) => navigated(s, here)), [here]);

  // The page's title names the tab (`AppShell` sets it, privacy setting included).
  useEffect(() => {
    const update = (): void => setState((s) => titled(s, s.active, tabTitle(document.title)));
    update();
    const head = document.querySelector('title') ?? document.head;
    const observer = new MutationObserver(update);
    observer.observe(head, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [here]);

  useEffect(() => save(state), [state]);

  // The strip's height, for every full-height screen below it.
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--tabs-h', overlay ? `env(titlebar-area-height, ${BAR_PX}px)` : `${BAR_PX}px`);
    root.setProperty('--app-h', 'calc(100dvh - var(--tabs-h))');
    return () => {
      root.removeProperty('--tabs-h');
      root.removeProperty('--app-h');
    };
  }, [overlay]);

  /*
    Drag to reorder (2026-10-16, Avi). As in Chrome: the pressed tab becomes
    active, follows the pointer, and when its middle passes a neighbour's
    middle the two swap; `startX` shifts by the neighbour's width so the tab
    stays under the pointer. A press that moves under DRAG_SLOP is a click.
    Pointer capture keeps the drag even when the pointer leaves the strip.
  */
  const tabEls = useRef(new Map<string, HTMLDivElement>());
  const dragRef = useRef<{ id: string; pointer: number; startX: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState<{ id: string; dx: number } | null>(null);
  const onTabDown = (id: string) => (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('[data-tab-close]')) return;
    if (id !== latest.current.active) go(activate(latest.current, id));
    dragRef.current = { id, pointer: event.pointerId, startX: event.clientX, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onTabMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const d = dragRef.current;
    if (!d || d.pointer !== event.pointerId) return;
    const dx = event.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < DRAG_SLOP) return;
    d.moved = true;
    const order = latest.current.tabs;
    const at = order.findIndex((t) => t.id === d.id);
    const self = tabEls.current.get(d.id)?.getBoundingClientRect();
    if (self) {
      const middle = self.left + self.width / 2 + dx;
      const right = order[at + 1] ? tabEls.current.get(order[at + 1]!.id)?.getBoundingClientRect() : undefined;
      const left = order[at - 1] ? tabEls.current.get(order[at - 1]!.id)?.getBoundingClientRect() : undefined;
      if (right && middle > right.left + right.width / 2) {
        d.startX += right.width + 4;
        setState((s) => moveTab(s, d.id, at + 1));
      } else if (left && middle < left.left + left.width / 2) {
        d.startX -= left.width + 4;
        setState((s) => moveTab(s, d.id, at - 1));
      }
    }
    setDragging({ id: d.id, dx: event.clientX - d.startX });
  };
  const onTabUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const d = dragRef.current;
    if (!d || d.pointer !== event.pointerId) return;
    dragRef.current = null;
    setDragging(null);
  };

  const go = (next: TabsState): void => {
    setState(next);
    const active = next.tabs.find((t) => t.id === next.active);
    // Replace, not push: Back stays inside the tab's own page, never jumps to another tab.
    if (active && active.url !== here) navigate(active.url, { replace: true });
  };

  // Ctrl/⌘+click and middle-click on a link in the app: a tab behind this one.
  useEffect(() => {
    const inApp = (event: MouseEvent): string | null => {
      const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.origin !== window.location.origin) return null;
      if (base && !link.pathname.startsWith(base)) return null;
      return `${link.pathname.slice(base.length) || '/'}${link.search}`;
    };
    const onClick = (event: MouseEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.button !== 0) return;
      const url = inApp(event);
      if (!url) return;
      event.preventDefault();
      setState((s) => openTab(s, url, { background: true }));
    };
    const onAux = (event: MouseEvent): void => {
      if (event.button !== 1) return;
      const url = inApp(event);
      if (!url) return;
      event.preventDefault();
      setState((s) => openTab(s, url, { background: true }));
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.ctrlKey && event.key === 'Tab') {
        event.preventDefault();
        go(cycle(latest.current, event.shiftKey ? -1 : 1));
      }
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('auxclick', onAux, true);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('auxclick', onAux, true);
      window.removeEventListener('keydown', onKey);
    };
    // `go` reads the latest state through `latest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, here]);

  const stripStyle: CSSProperties = overlay
    ? {
        ...drag,
        left: 'env(titlebar-area-x, 0)',
        top: 'env(titlebar-area-y, 0)',
        width: 'env(titlebar-area-width, 100%)',
        height: `env(titlebar-area-height, ${BAR_PX}px)`,
      }
    : { ...drag, left: 0, right: 0, top: 0, height: BAR_PX };

  return (
    <>
      <nav data-app-tabs aria-label="Tab Plano" style={stripStyle} className="fixed z-50 flex items-end gap-1 border-b border-border bg-bg-subtle px-2 pt-1">
        {/*
          The tab list fills the strip's height (`self-stretch`), plus the 1 px of
          the strip's bottom border (`-mb-px`): a tab's `h-full` needs a parent
          with a height (with an auto-height parent it fell back to its content,
          ~28 of 44 px, and the empty band above it dragged the window instead of
          choosing the tab), and the active tab covers the border so it joins the
          page below, as in Chrome.
        */}
        <div role="tablist" aria-label="Tab" className="-mb-px flex min-w-0 items-end gap-1 self-stretch overflow-hidden">
          {state.tabs.map((tab) => {
            const on = tab.id === state.active;
            const label = tabLabel(tab);
            return (
              <div
                key={tab.id}
                ref={(node) => {
                  if (node) tabEls.current.set(tab.id, node);
                  else tabEls.current.delete(tab.id);
                }}
                style={{
                  ...noDrag,
                  ...(dragging?.id === tab.id ? { transform: `translateX(${dragging.dx}px)`, zIndex: 1, cursor: 'grabbing' } : {}),
                }}
                onPointerDown={onTabDown(tab.id)}
                onPointerMove={onTabMove}
                onPointerUp={onTabUp}
                onPointerCancel={onTabUp}
                onAuxClick={(event) => {
                  if (event.button === 1) go(closeTab(latest.current, tab.id));
                }}
                className={`group relative flex h-full w-[240px] min-w-[96px] shrink touch-none select-none items-center rounded-t-lg border border-b-0 text-sm ${
                  on
                    ? 'border-border bg-bg font-semibold text-fg'
                    : 'border-transparent bg-[color-mix(in_srgb,var(--fg)_7%,transparent)] text-fg-muted hover:bg-[color-mix(in_srgb,var(--fg)_12%,transparent)] hover:text-fg'
                } ${dragging?.id === tab.id ? 'shadow-pop' : 'transition-transform'}`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={on}
                  title={label}
                  onClick={() => go(activate(latest.current, tab.id))}
                  className="h-full min-w-0 flex-1 cursor-default truncate rounded-tl-lg px-3.5 text-left focus-visible:-outline-offset-2"
                >
                  {label}
                </button>
                <button
                  type="button"
                  data-tab-close
                  aria-label={`Tutup tab ${label}`}
                  onClick={() => go(closeTab(latest.current, tab.id))}
                  className={`mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-base leading-none hover:bg-bg-subtle [@media(pointer:coarse)]:h-8 [@media(pointer:coarse)]:w-8 ${on ? '' : 'opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100'}`}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          style={noDrag}
          aria-label="Tab baru"
          title="Tab baru"
          onClick={() => go(openTab(latest.current, HOME_URL))}
          className="mb-1 flex h-9 w-9 shrink-0 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 items-center justify-center rounded-lg text-xl leading-none text-fg-muted hover:bg-bg hover:text-fg"
        >
          +
        </button>
        {/* The rest of the title bar: free to drag the window by. */}
        <span className="min-w-16 flex-1 self-stretch" aria-hidden />
      </nav>
      <div style={{ paddingTop: 'var(--tabs-h)' }}>{children}</div>
    </>
  );
}
