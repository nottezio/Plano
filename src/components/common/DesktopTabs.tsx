import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  activate,
  closeTab,
  cycle,
  HOME_URL,
  launch,
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
const BAR_PX = 36;

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

/** Installed (its own window), with a mouse, and wide enough for a strip. */
export function useDesktopTabsEnabled(): boolean {
  const installed = useMediaQuery('(display-mode: standalone), (display-mode: window-controls-overlay)');
  const desktop = useMediaQuery('(pointer: fine) and (min-width: 900px)');
  return installed && desktop;
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
        <div role="tablist" aria-label="Tab" className="flex min-w-0 items-end gap-1 overflow-hidden">
          {state.tabs.map((tab) => {
            const on = tab.id === state.active;
            const label = tabLabel(tab);
            return (
              <div
                key={tab.id}
                style={noDrag}
                onAuxClick={(event) => {
                  if (event.button === 1) go(closeTab(latest.current, tab.id));
                }}
                className={`group flex h-[calc(100%-2px)] w-[220px] min-w-[72px] shrink items-center rounded-t-lg border border-b-0 text-xs ${
                  on ? 'border-border bg-bg font-semibold text-fg' : 'border-transparent text-fg-muted hover:bg-bg/60'
                }`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={on}
                  title={label}
                  onClick={() => go(activate(latest.current, tab.id))}
                  className="h-full min-w-0 flex-1 truncate px-3 text-left"
                >
                  {label}
                </button>
                <button
                  type="button"
                  aria-label={`Tutup tab ${label}`}
                  onClick={() => go(closeTab(latest.current, tab.id))}
                  className={`mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-sm leading-none hover:bg-bg-subtle ${on ? '' : 'opacity-0 group-hover:opacity-100'}`}
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
          className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-fg-muted hover:bg-bg"
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
