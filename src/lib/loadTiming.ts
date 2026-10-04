import { useEffect, useRef } from 'react';

import { logSessionEvent } from './sessionLog';

/**
 * Why "Memuat…" was slow, written down when it happens (2026-10-05).
 *
 * WHY MEASURE INSTEAD OF FIX
 *
 * "Memuat… takes too long, sometimes, out of nowhere, on the laptop" has at
 * least four causes that look identical on screen, and each needs a different
 * fix:
 *
 * 1. Chrome discarded the background tab (Memory Saver) and coming back to it
 *    is a full cold start: boot, auth, access, then the lists.
 * 2. Several Plano tabs are open. Firestore's multi-tab cache lets ONE tab be
 *    primary; the tab on screen waits for a background tab that Chrome has
 *    frozen or throttled to hand it over.
 * 3. The local cache answered slowly (a large IndexedDB).
 * 4. The data was not cached and had to come from the server.
 *
 * Shipping a fix for one of them blind is the four-releases-of-guesses pattern
 * the session log was built to end. So each wait that crosses `SLOW_MS` is
 * logged with what separates the causes: how the page was started, how many
 * other Plano tabs exist, whether this tab was visible, and (from the log
 * itself) whether the browser was online.
 *
 * Nothing about a patient is recorded: a label, a duration, counts.
 */

/** A wait shorter than this is not worth a line in a 40-line log. */
export const SLOW_MS = 2000;

const TABS_KEY = 'plano.tabs';
/** A tab entry not refreshed for this long belongs to a tab that died uncleanly. */
const TAB_STALE_MS = 12 * 60 * 60_000;
/** Hidden for at least this long counts as "came back to it". */
const LONG_HIDDEN_MS = 10 * 60_000;

const tabId = Math.random().toString(36).slice(2, 10);

/** Seconds with one decimal, Indonesian style: `4,2 dtk`. */
export function formatSeconds(ms: number): string {
  return `${(Math.round(ms / 100) / 10).toFixed(1).replace('.', ',')} dtk`;
}

/**
 * How this page came to be loaded.
 *
 * `document.wasDiscarded` is Chrome's own flag for "this tab was thrown away
 * to save memory and reloaded when you came back" — cause 1, named outright.
 */
export function bootReason(): string {
  const parts: string[] = [];
  try {
    const nav = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    const type = nav?.type;
    if (type === 'reload') parts.push('dimuat ulang');
    else if (type === 'back_forward') parts.push('kembali/maju');
    else if (type === 'navigate') parts.push('dibuka');
  } catch {
    // No navigation timing: say nothing rather than guess.
  }
  if ((document as Document & { wasDiscarded?: boolean }).wasDiscarded) {
    parts.push('tab sempat dibuang Chrome (hemat memori)');
  }
  return parts.join(' · ');
}

type TabMap = Record<string, number>;

function readTabs(): TabMap {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(TABS_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as TabMap) : {};
  } catch {
    return {};
  }
}

function writeTabs(tabs: TabMap): void {
  try {
    localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
  } catch {
    // Not counted; the diagnostic just loses one field.
  }
}

function touchTab(): void {
  const now = Date.now();
  const tabs = readTabs();
  for (const [id, seen] of Object.entries(tabs)) {
    if (typeof seen !== 'number' || now - seen > TAB_STALE_MS) delete tabs[id];
  }
  tabs[tabId] = now;
  writeTabs(tabs);
}

/**
 * Other Plano tabs in this browser, frozen ones included.
 *
 * A registry rather than a ping: the tab that matters most for cause 2 is a
 * frozen one, and a frozen tab cannot answer a ping. Each tab adds itself on
 * start and removes itself when it is closed; a crash leaves an entry that
 * expires after `TAB_STALE_MS`. So the count can be high by a stale tab or
 * two; it is a hint, labelled as such in the log.
 */
export function otherTabCount(): number {
  return Object.keys(readTabs()).filter((id) => id !== tabId).length;
}

function context(): string {
  const parts: string[] = [];
  const others = otherTabCount();
  if (others > 0) parts.push(`${others} tab Plano lain terbuka`);
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    parts.push('tab tidak terlihat');
  }
  return parts.join(' · ');
}

/** Log a wait if it was slow. Exported for waits that are not a hook. */
export function reportWait(label: string, ms: number, note = ''): void {
  if (ms < SLOW_MS) return;
  const detail = [`${label} ${formatSeconds(ms)}`, note, context()].filter(Boolean).join(' · ');
  logSessionEvent('slow', detail);
}

/**
 * Called once at start-up: joins the tab registry and watches for the two
 * ways a tab comes back from being away (cause 1's cousin: frozen, not
 * discarded, and back after a long time hidden).
 */
export function installLoadDiagnostics(): void {
  if (typeof window === 'undefined') return;
  touchTab();
  window.addEventListener('pagehide', (event) => {
    // A page kept in the back/forward cache is not closed.
    if ((event as PageTransitionEvent).persisted) return;
    const tabs = readTabs();
    delete tabs[tabId];
    writeTabs(tabs);
  });

  let hiddenAt: number | null = document.visibilityState === 'hidden' ? Date.now() : null;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    touchTab();
    if (hiddenAt !== null && Date.now() - hiddenAt >= LONG_HIDDEN_MS) {
      const minutes = Math.round((Date.now() - hiddenAt) / 60_000);
      logSessionEvent('resumed', `tab tidak dilihat ${minutes} mnt`);
    }
    hiddenAt = null;
  });
  // Chrome's page lifecycle: a frozen tab runs no code at all until resumed.
  document.addEventListener('resume', () => {
    touchTab();
    logSessionEvent('resumed', 'tab sempat dibekukan Chrome');
  });
}

/**
 * Times a loading state and logs it if it was slow.
 *
 * `waiting` true starts the clock, false stops it. If the component unmounts
 * while still waiting, that is logged too — with `(ditinggalkan)`, because a
 * wait the user gave up on is the slowest kind — unless `endsOnUnmount` says
 * unmounting IS the end (a boot screen exists only while booting).
 */
export function useSlowWait(
  label: string,
  waiting: boolean,
  { endsOnUnmount = false }: { endsOnUnmount?: boolean } = {},
): void {
  const started = useRef<number | null>(null);

  useEffect(() => {
    if (waiting) {
      started.current ??= performance.now();
      return;
    }
    if (started.current !== null) {
      reportWait(label, performance.now() - started.current);
      started.current = null;
    }
  }, [label, waiting]);

  useEffect(
    () => () => {
      if (started.current === null) return;
      reportWait(label, performance.now() - started.current, endsOnUnmount ? '' : '(ditinggalkan)');
      started.current = null;
    },
    [label, endsOnUnmount],
  );
}
