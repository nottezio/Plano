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

const THEME_STORAGE_KEY = 'visite.theme';

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
