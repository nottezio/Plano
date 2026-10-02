import { createPath, NavigationType, type To, type unstable_HistoryRouter } from 'react-router-dom';
import type { ComponentProps } from 'react';

import { ancestorsOf, planNavigation, screenLevel, type NavPlan } from '@/domain/navigation';

/**
 * The app's own browser history: back goes UP, like an app, not to whatever
 * was open before.
 *
 * React Router's BrowserRouter pushes an entry for every navigation, so the
 * phone's back button replayed the session (see `domain/navigation` for the
 * model and why). This is a drop-in `History` for `unstable_HistoryRouter`
 * that plans every push and replace with `planNavigation`, so the browser's
 * stack is always board → section → detail and nothing else.
 *
 * Three more things an app does and a website does not:
 *
 *  1. OPENED ON A DETAIL, back still goes to its parent. A fresh tab on
 *     /p/x is rewritten to "/" with /p/x pushed on top.
 *  2. BACK CLOSES THE OPEN SHEET first. While a sheet or dialog is open there
 *     is one extra entry (same URL) on top; back consumes it and closes the
 *     sheet instead of leaving the screen. Closed with ✕ instead, the entry is
 *     left "spent": the next navigation replaces it, and a back press on it
 *     skips straight through to the parent.
 *  3. COMING BACK, the list is where it was left. The scroll position of each
 *     entry is kept and restored on back (`savedScroll`, used by AppShell).
 *
 * Every entry still carries React Router's own `{ usr, key, idx }` state, so
 * location.state and keys behave exactly as before.
 */

type RouterHistory = ComponentProps<typeof unstable_HistoryRouter>['history'];
type RouterLocation = RouterHistory['location'];
type Listener = Parameters<RouterHistory['listen']>[0];

interface EntryState {
  usr: unknown;
  key: string;
  idx: number;
  /** The extra entry pushed while a sheet is open. */
  sheet?: true;
}

const STORE_KEY = 'plano.nav';

/** "" or "/Plano" — the deployment's base path, without the trailing slash. */
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

function toApp(pathname: string, search: string): string {
  const path =
    BASE && (pathname === BASE || pathname.startsWith(`${BASE}/`))
      ? pathname.slice(BASE.length) || '/'
      : pathname;
  return path + search;
}

function toFull(appHref: string): string {
  return BASE + appHref;
}

function createKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

function readState(): Partial<EntryState> | null {
  const state: unknown = window.history.state;
  return state && typeof state === 'object' ? (state as Partial<EntryState>) : null;
}

interface Stored {
  trail: (string | null)[];
  sheetAt: number | null;
  scroll: Record<string, number>;
}

function load(): Stored {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Stored>;
      return {
        trail: Array.isArray(parsed.trail) ? parsed.trail : [],
        sheetAt: typeof parsed.sheetAt === 'number' ? parsed.sheetAt : null,
        scroll: parsed.scroll && typeof parsed.scroll === 'object' ? parsed.scroll : {},
      };
    }
  } catch {
    // Private mode or blocked storage: the app still works, a reload just
    // forgets where back leads beyond the current entry.
  }
  return { trail: [], sheetAt: null, scroll: {} };
}

interface Overlay {
  close: () => void;
}

let singleton: AppHistory | null = null;

export interface AppHistory extends RouterHistory {
  /** Go to the screen above this one (the in-app ← button). */
  up: (fallback: string) => void;
  /** Register an open sheet so back closes it. Returns the unregister function. */
  openOverlay: (close: () => void) => () => void;
  savedScroll: (key: string) => number;
}

export function createAppHistory(): AppHistory {
  const g = window.history;
  const stored = load();
  const trail: (string | undefined)[] = stored.trail.map((entry) => entry ?? undefined);
  const scroll = stored.scroll;
  let sheetAt: number | null = stored.sheetAt;
  let index: number;
  let action: RouterHistory['action'] = NavigationType.Pop;
  const listeners = new Set<Listener>();
  let pending: { to: To; state: unknown; then: 'none' | 'push' | 'replace' } | null = null;
  const overlays: Overlay[] = [];

  const hereApp = (): string => toApp(window.location.pathname, window.location.search);

  const persist = (): void => {
    try {
      // Only the latest 200 scroll positions; a long shift must not grow this forever.
      const keys = Object.keys(scroll);
      for (const stale of keys.slice(0, Math.max(0, keys.length - 200))) delete scroll[stale];
      sessionStorage.setItem(
        STORE_KEY,
        JSON.stringify({ trail: trail.map((entry) => entry ?? null), sheetAt, scroll }),
      );
    } catch {
      // See load().
    }
  };

  // ---- boot -------------------------------------------------------------
  const boot = readState();
  if (typeof boot?.idx === 'number') {
    // A reload: the entries are the browser's, the trail is ours from before.
    index = boot.idx;
    trail[index] = hereApp();
    if (sheetAt !== null && sheetAt !== index) sheetAt = null;
  } else {
    // A fresh entry. If it is below the board, put its parents under it.
    const here = hereApp();
    const full = window.location.pathname + window.location.search + window.location.hash;
    const chain = ancestorsOf(here);
    trail.length = 0;
    sheetAt = null;
    index = 0;
    const usr = boot && 'usr' in boot ? boot.usr : null;
    if (chain.length > 0) {
      chain.forEach((href, i) => {
        const state: EntryState = { usr: null, key: createKey(), idx: i };
        if (i === 0) g.replaceState(state, '', toFull(href));
        else g.pushState(state, '', toFull(href));
        trail[i] = href;
      });
      index = chain.length;
      g.pushState({ usr, key: createKey(), idx: index } satisfies EntryState, '', full);
    } else {
      g.replaceState({ usr, key: boot?.key ?? 'default', idx: 0 } satisfies EntryState, '', full);
    }
    trail[index] = here;
  }
  persist();

  const getLocation = (): RouterLocation => {
    const state = readState();
    return {
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      state: state?.usr ?? null,
      key: state?.key ?? 'default',
    };
  };
  let location = getLocation();

  const notify = (next: RouterHistory['action'], delta: number | null): void => {
    action = next;
    location = getLocation();
    for (const fn of listeners) fn({ action, location, delta });
  };

  const saveScroll = (): void => {
    const main = document.getElementById('main');
    if (main) scroll[location.key] = main.scrollTop;
  };

  const createHref = (to: To): string => (typeof to === 'string' ? to : createPath(to));
  const createURL = (to: To): URL => new URL(createHref(to), window.location.origin);
  const appOf = (to: To): string => {
    const url = createURL(to);
    return toApp(url.pathname, url.search);
  };

  const write = (kind: 'push' | 'replace', to: To, state: unknown): void => {
    saveScroll();
    const href = createHref(to);
    if (kind === 'push') index += 1;
    const entry: EntryState = { usr: state ?? null, key: createKey(), idx: index };
    try {
      if (kind === 'push') g.pushState(entry, '', href);
      else g.replaceState(entry, '', href);
    } catch {
      // iOS throttles history calls; a real navigation is the fallback.
      window.location.assign(href);
      return;
    }
    trail[index] = appOf(to);
    if (kind === 'push') trail.length = index + 1;
    if (sheetAt !== null && sheetAt >= index) sheetAt = null;
    persist();
    notify(kind === 'push' ? NavigationType.Push : NavigationType.Replace, kind === 'push' ? 1 : 0);
  };

  const run = (plan: NavPlan, to: To, state: unknown): void => {
    if (plan.kind === 'back') {
      saveScroll();
      pending = { to, state, then: plan.then };
      g.go(plan.delta);
      return;
    }
    write(plan.kind, to, state);
  };

  const navigate = (mode: 'push' | 'replace', to: To, state: unknown): void => {
    const target = appOf(to);
    if (sheetAt === index && index > 0) {
      // On top of a sheet's entry (open, or closed with ✕). Plan from the
      // screen underneath, and use the sheet entry as the first step.
      const plan = planNavigation(trail, index - 1, target, mode);
      sheetAt = null;
      if (plan.kind === 'push') write('replace', to, state);
      else if (plan.kind === 'replace') run({ kind: 'back', delta: -1, then: 'replace' }, to, state);
      else run({ ...plan, delta: plan.delta - 1 }, to, state);
      return;
    }
    run(planNavigation(trail, index, target, mode), to, state);
  };

  const pushSheetEntry = (): void => {
    const current = readState();
    index += 1;
    g.pushState(
      { usr: current?.usr ?? null, key: current?.key ?? location.key, idx: index, sheet: true } satisfies EntryState,
      '',
      window.location.href,
    );
    trail[index] = trail[index - 1];
    trail.length = index + 1;
    sheetAt = index;
    persist();
  };

  window.addEventListener('popstate', () => {
    const state = readState();
    const left = index;
    const next = typeof state?.idx === 'number' ? state.idx : null;

    // Back out of a sheet's entry: the screen stays, the sheet closes.
    if (!pending && sheetAt === left && next !== null && next < left) {
      index = next;
      sheetAt = null;
      persist();
      const top = overlays.pop();
      if (top) {
        top.close();
        if (overlays.length > 0) pushSheetEntry();
        return;
      }
      // Spent entry (the sheet was closed with ✕): this press meant "back",
      // so carry on to the screen above (or out of the app, from the board).
      g.go(-1);
      return;
    }

    saveScroll();
    if (next !== null) index = next;
    trail[index] = hereApp();
    if (sheetAt !== null && sheetAt !== index) sheetAt = null;
    persist();

    if (pending) {
      const { to, state: usr, then } = pending;
      pending = null;
      if (then !== 'none') {
        write(then, to, usr);
        return;
      }
    }
    notify(NavigationType.Pop, next === null ? null : next - left);
  });

  const history: AppHistory = {
    get action() {
      return action;
    },
    get location() {
      return location;
    },
    createHref,
    createURL,
    encodeLocation(to) {
      const url = createURL(to);
      return { pathname: url.pathname, search: url.search, hash: url.hash };
    },
    push(to, state) {
      navigate('push', to, state);
    },
    replace(to, state) {
      navigate('replace', to, state);
    },
    go(delta) {
      g.go(delta);
    },
    listen(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    up(fallback) {
      const from = index - (sheetAt === index ? 1 : 0);
      const current = trail[from];
      const level = current === undefined ? 0 : screenLevel(current);
      for (let k = from - 1; k >= 0; k -= 1) {
        const entry = trail[k];
        if (entry === undefined) break;
        if (screenLevel(entry) < level) {
          saveScroll();
          sheetAt = null;
          g.go(k - index);
          return;
        }
      }
      navigate('push', toFull(fallback), null);
    },
    openOverlay(close) {
      const overlay: Overlay = { close };
      overlays.push(overlay);
      if (sheetAt !== index) pushSheetEntry();
      return () => {
        const at = overlays.indexOf(overlay);
        if (at !== -1) overlays.splice(at, 1);
        // The entry stays (spent); see the header.
      };
    },
    savedScroll(key) {
      return scroll[key] ?? 0;
    },
  };
  singleton = history;
  return history;
}

/** The running app's history (null in tests and before boot). */
export function appHistory(): AppHistory | null {
  return singleton;
}
