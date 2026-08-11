import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';

/**
 * SPEC 7.4 — sync pill states. Wired to Firestore metadata in P1; modelled now
 * so the shell does not need reworking later.
 */
export type SyncState =
  | { kind: 'synced' }
  | { kind: 'saving' }
  | { kind: 'offline'; pending: number };

interface UIState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  /**
   * Force-save callbacks from every live editor.
   *
   * The update banner used to refuse to reload while anything was unsaved and
   * leave the user there — correct about the risk, useless about the remedy,
   * since "save first" describes something the app does on a timer and offers
   * no button for. It can now save everything itself and then reload.
   */
  registerFlush: (key: string, flush: () => void) => () => void;
  flushAll: () => void;
  /**
   * The reporting format expected for the patient currently open.
   *
   * Lives in the store rather than being passed down because the sidebar and
   * the patient page are siblings under the shell, and threading a prop through
   * `AppShell` would make every screen carry a field only one of them uses.
   * Set by the patient page, cleared when it unmounts.
   */
  dpjpHint: { initials: string; name: string; description: string } | null;
  setDpjpHint: (hint: { initials: string; name: string; description: string } | null) => void;
  /** Desktop context sidebar on the patient page. Expanded by default. */
  contextPaneOpen: boolean;
  toggleContextPane: () => void;

  sync: SyncState;
  setSync: (sync: SyncState) => void;

  /**
   * Editors register themselves here while they hold unflushed keystrokes.
   * The service-worker update gate (SPEC 17: "never auto-reload while the
   * editor is dirty") reads this, so it must be a set of ids rather than a
   * boolean — two editors can be mounted in iPad split view.
   */
  dirtyEditors: ReadonlySet<string>;
  markDirty: (editorId: string) => void;
  markClean: (editorId: string) => void;
  hasUnsavedWork: () => boolean;
}

/**
 * Outside the store on purpose: these are callbacks, not state. Putting them in
 * the store would re-render every subscriber each time an editor mounts.
 */
const FLUSHERS = new Map<string, () => void>();

const THEME_STORAGE_KEY = 'visite.theme';
const PANE_STORAGE_KEY = 'visite.contextPane';

/**
 * Expanded unless the user has said otherwise.
 *
 * The pane holds the date rail and the checklist — things consulted while
 * writing, not occasionally. Defaulting it closed would hide the checklist
 * behind a click on the one screen where ticking it is the job.
 */
function readStoredPane(): boolean {
  try {
    return localStorage.getItem(PANE_STORAGE_KEY) !== 'closed';
  } catch {
    return true;
  }
}

function applyThemeClass(theme: ThemePreference): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = theme === 'dark' || (theme === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', dark);
}

function readStoredTheme(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch (error) {
    console.warn('[ui] theme preference unreadable', error);
  }
  return 'system';
}

export const useUI = create<UIState>((set, get) => ({
  theme: readStoredTheme(),
  dpjpHint: null,
  setDpjpHint: (dpjpHint) => set({ dpjpHint }),
  registerFlush: (key, flush) => {
    FLUSHERS.set(key, flush);
    return () => {
      FLUSHERS.delete(key);
    };
  },
  flushAll: () => {
    for (const flush of FLUSHERS.values()) {
      try {
        flush();
      } catch (error) {
        console.error('[ui] flush failed', error);
      }
    }
  },
  contextPaneOpen: readStoredPane(),
  toggleContextPane: () =>
    set((state) => {
      const next = !state.contextPaneOpen;
      try {
        localStorage.setItem(PANE_STORAGE_KEY, next ? 'open' : 'closed');
      } catch (error) {
        console.warn('[ui] pane preference not saved', error);
      }
      return { contextPaneOpen: next };
    }),
  setTheme: (theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.warn('[ui] theme preference not persisted', error);
    }
    applyThemeClass(theme);
    set({ theme });
  },

  sync: { kind: 'synced' },
  setSync: (sync) => set({ sync }),

  dirtyEditors: new Set<string>(),
  markDirty: (editorId) =>
    set((state) => {
      if (state.dirtyEditors.has(editorId)) return state;
      const next = new Set(state.dirtyEditors);
      next.add(editorId);
      return { dirtyEditors: next };
    }),
  markClean: (editorId) =>
    set((state) => {
      if (!state.dirtyEditors.has(editorId)) return state;
      const next = new Set(state.dirtyEditors);
      next.delete(editorId);
      return { dirtyEditors: next };
    }),
  hasUnsavedWork: () => get().dirtyEditors.size > 0,
}));

/** Called once at boot and whenever the OS scheme changes under 'system'. */
export function initThemeSync(): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  applyThemeClass(useUI.getState().theme);
  const handler = (): void => {
    if (useUI.getState().theme === 'system') applyThemeClass('system');
  };
  media.addEventListener('change', handler);
  return () => media.removeEventListener('change', handler);
}
