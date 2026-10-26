import { create } from 'zustand';

import { isTheme, resolveTheme, SENJA_BG, THEME_KEY, type ThemePreference } from '@/domain/theme';
import { applyPalette, isPalette, isSurface, PALETTE_KEY, SURFACE_KEY, type PaletteId, type SurfaceId } from '@/domain/palette';

function readStored<T>(key: string, valid: (v: unknown) => v is T, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return valid(raw) ? raw : fallback;
  } catch {
    return fallback;
  }
}

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn('[ui] preference not persisted', error);
  }
}

export type { ThemePreference };

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
  /** Accent palette and background (13.15), on this device. */
  palette: PaletteId;
  surface: SurfaceId;
  setPalette: (palette: PaletteId) => void;
  setSurface: (surface: SurfaceId) => void;
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
   * True while a preview that is ALLOWED to carry non-ASCII is on screen —
   * WhatsApp or markdown, never SIMGOS.
   *
   * INVERTED from the flag it replaces (`simgosPreview`), and the polarity is
   * the whole point. Folding used to be opt-in, switched on only while the
   * Salin sheet was open on the plain tab, so ASCII was guaranteed on exactly
   * one screen out of the app. Text selected anywhere else — the note editor,
   * a document, the board — went to the clipboard unfolded, and pasting that
   * into SIMGOS is the `?` that has been reported for three releases.
   *
   * The two mistakes are not symmetrical. Folding text that did not need it
   * costs `°C` becoming ` derajat C` in a WhatsApp message. Not folding text
   * that did costs a `?` in the medical record, invisible until someone else
   * reads it. So the safe direction is the default and the exception is what
   * has to be declared.
   */
  nonAsciiPreview: boolean;
  setNonAsciiPreview: (on: boolean) => void;
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

const THEME_STORAGE_KEY = THEME_KEY;
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
  const { dark, senja } = resolveTheme(theme, prefersDark);
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  if (senja) root.setAttribute('data-theme', 'senja');
  else root.removeAttribute('data-theme');
  // The browser's bar colour follows Senja's ground (the two metas are by device scheme).
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.dataset.original ??= meta.content;
    meta.content = senja ? SENJA_BG : (meta.dataset.original ?? meta.content);
  }
}

function readStoredTheme(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(raw)) return raw;
  } catch (error) {
    console.warn('[ui] theme preference unreadable', error);
  }
  return 'system';
}

export const useUI = create<UIState>((set, get) => ({
  nonAsciiPreview: false,
  setNonAsciiPreview: (on) => set({ nonAsciiPreview: on }),
  theme: readStoredTheme(),
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
  palette: readStored<PaletteId>(PALETTE_KEY, isPalette, 'biru'),
  surface: readStored<SurfaceId>(SURFACE_KEY, isSurface, 'standar'),
  setPalette: (palette) => {
    store(PALETTE_KEY, palette);
    applyPalette(palette, get().surface);
    set({ palette });
  },
  setSurface: (surface) => {
    store(SURFACE_KEY, surface);
    applyPalette(get().palette, surface);
    set({ surface });
  },
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
