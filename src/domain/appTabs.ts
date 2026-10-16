/**
 * Tabs inside the installed desktop app (2026-10-16, Avi: "a tab like a
 * browser — only for the installed app on desktop").
 *
 * Chrome's own tabbed mode for installed apps (`display_override: ["tabbed"]`)
 * ships on ChromeOS only, and the Chrome team has said other platforms are not
 * planned; on Windows the app window has one page. So the tabs are Plano's:
 * each tab is a place in the app (a route, with its query), the active one is
 * what the router shows, and switching tab is a navigation. A page's own
 * state lives in the stores and Firestore, so it is all there again when its
 * tab is reopened; the scroll position comes back through `appHistory`.
 *
 * Pure: the strip (`components/common/DesktopTabs`) does the DOM and storage.
 */

export interface AppTab {
  id: string;
  /** Path + query inside the app, without the deployment base ("/list?f=x"). */
  url: string;
  /** The page's title as the app sets it ("Tn. Contoh", "List Maker"); '' until known. */
  title: string;
}

export interface TabsState {
  tabs: AppTab[];
  active: string;
}

export const MAX_TABS = 12;
export const HOME_URL = '/';

let counter = 0;
export function newTabId(): string {
  counter += 1;
  return `t${Date.now().toString(36)}${counter.toString(36)}`;
}

export function initialTabs(url: string, id = newTabId()): TabsState {
  return { tabs: [{ id, url, title: '' }], active: id };
}

/** A new tab after the active one; `background` keeps the active tab (Ctrl+click), else it becomes active. */
export function openTab(state: TabsState, url: string, options: { background?: boolean; id?: string } = {}): TabsState {
  if (state.tabs.length >= MAX_TABS) {
    // Full: the URL opens in the active tab instead, like a cap on any strip.
    return options.background ? state : navigated(state, url);
  }
  const id = options.id ?? newTabId();
  const at = state.tabs.findIndex((t) => t.id === state.active);
  const tabs = [...state.tabs];
  tabs.splice(at + 1, 0, { id, url, title: '' });
  return { tabs, active: options.background ? state.active : id };
}

/**
 * Closing: the tab to the right becomes active (else the left), as in a
 * browser. The last tab is never closed — it goes back to the board.
 */
export function closeTab(state: TabsState, id: string): TabsState {
  const at = state.tabs.findIndex((t) => t.id === id);
  if (at === -1) return state;
  if (state.tabs.length === 1) return { tabs: [{ ...state.tabs[0]!, url: HOME_URL, title: '' }], active: state.tabs[0]!.id };
  const tabs = state.tabs.filter((t) => t.id !== id);
  if (state.active !== id) return { tabs, active: state.active };
  const next = tabs[Math.min(at, tabs.length - 1)]!;
  return { tabs, active: next.id };
}

export function activate(state: TabsState, id: string): TabsState {
  return state.tabs.some((t) => t.id === id) ? { ...state, active: id } : state;
}

/** Ctrl+Tab / Ctrl+Shift+Tab. */
export function cycle(state: TabsState, step: 1 | -1): TabsState {
  const at = state.tabs.findIndex((t) => t.id === state.active);
  const next = state.tabs[(at + step + state.tabs.length) % state.tabs.length]!;
  return { ...state, active: next.id };
}

/** The router moved inside the active tab: it follows. */
export function navigated(state: TabsState, url: string): TabsState {
  return { ...state, tabs: state.tabs.map((t) => (t.id === state.active ? (t.url === url ? t : { ...t, url, title: '' }) : t)) };
}

/** "Tn. Contoh · Plano" → "Tn. Contoh"; the board's bare "Plano" stays. */
export function tabTitle(documentTitle: string): string {
  return documentTitle.replace(/\s*·\s*Plano\s*$/, '').trim() || 'Plano';
}

export function titled(state: TabsState, id: string, title: string): TabsState {
  return { ...state, tabs: state.tabs.map((t) => (t.id === id && t.title !== title ? { ...t, title } : t)) };
}

/** Stored tabs, cleaned: anything malformed gives `null` (start fresh). */
export function readTabs(raw: string | null): TabsState | null {
  try {
    const data = JSON.parse(raw ?? 'null') as Partial<TabsState> | null;
    if (!data || !Array.isArray(data.tabs)) return null;
    const tabs = data.tabs
      .filter((t): t is AppTab => !!t && typeof t.id === 'string' && typeof t.url === 'string' && t.url.startsWith('/'))
      .slice(0, MAX_TABS)
      .map((t) => ({ id: t.id, url: t.url, title: typeof t.title === 'string' ? t.title : '' }));
    if (tabs.length === 0) return null;
    const active = tabs.some((t) => t.id === data.active) ? (data.active as string) : tabs[0]!.id;
    return { tabs, active };
  } catch {
    return null;
  }
}

const PAGE_NAMES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\/$/, 'Aktif'],
  [/^\/arsip\b/, 'Arsip'],
  [/^\/dokumen\b/, 'Dokumen'],
  [/^\/catatan\b/, 'Catatan'],
  [/^\/kalkulator\b/, 'Kalkulator'],
  [/^\/checklist\b/, 'Checklist'],
  [/^\/helper\b/, 'Helper'],
  [/^\/list\b/, 'List Maker'],
  [/^\/pengaturan\b/, 'Pengaturan'],
  [/^\/p\//, 'Pasien'],
];

/**
 * What a tab is called before its page has set a title (a tab opened behind
 * with Ctrl+click has never been shown) — and on the board, whose own title is
 * just "Plano".
 */
export function tabLabel(tab: Pick<AppTab, 'url' | 'title'>): string {
  const path = tab.url.split('?')[0] ?? '/';
  const named = PAGE_NAMES.find(([re]) => re.test(path))?.[1];
  if (tab.title && tab.title !== 'Plano') return tab.title;
  return named ?? 'Plano';
}

/**
 * The tabs when the app opens at `url`. At the board (a normal launch): the
 * stored tabs as they were. At a page one of the tabs already shows (a
 * reload): that tab. Anywhere else (a link opened in the app): a new tab.
 */
export function launch(stored: TabsState | null, url: string): TabsState {
  if (!stored) return initialTabs(url);
  if (url === HOME_URL) return stored;
  const same = stored.tabs.find((t) => t.url === url);
  if (same) return { ...stored, active: same.id };
  return openTab(stored, url);
}

/** Drag to reorder (2026-10-16): the tab `id` moved to position `to` (clamped). */
export function moveTab(state: TabsState, id: string, to: number): TabsState {
  const from = state.tabs.findIndex((t) => t.id === id);
  if (from === -1) return state;
  const at = Math.max(0, Math.min(to, state.tabs.length - 1));
  if (at === from) return state;
  const tabs = [...state.tabs];
  const [tab] = tabs.splice(from, 1);
  tabs.splice(at, 0, tab!);
  return { ...state, tabs };
}
