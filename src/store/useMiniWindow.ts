import { create } from 'zustand';

import { openMiniWindow } from '@/lib/miniWindow';

/** What the small window shows: one Catatan, or a list's shared Catatan Visite. */
export type MiniTarget = { kind: 'scratch'; id: string } | { kind: 'floor'; floorId: string };

interface MiniWindowState {
  target: MiniTarget | null;
  win: Window | null;
  /** False when the browser opened no window (popup blocked): show it inline instead. */
  open: (target: MiniTarget) => Promise<boolean>;
  close: () => void;
}

/**
 * The small window, owned at the app root (24 Oct 2026). It used to belong to
 * the Catatan page, whose unmount closed it: going to any other tab of the app
 * shut the window. Now only the person (or opening another) closes it; closing
 * or reloading the main Plano tab still does, the browser ties them together.
 * Document Picture-in-Picture allows one window per tab, so there is one here.
 */
export const useMiniWindow = create<MiniWindowState>((set, get) => ({
  target: null,
  win: null,
  open: async (target) => {
    get().win?.close();
    const win = await openMiniWindow(target.kind === 'floor' ? 'Plano · Catatan Visite' : 'Plano · Catatan');
    if (!win) {
      set({ target: null, win: null });
      return false;
    }
    win.addEventListener('pagehide', () => {
      if (get().win === win) set({ target: null, win: null });
    });
    set({ target, win });
    return true;
  },
  close: () => {
    get().win?.close();
    set({ target: null, win: null });
  },
}));

// The popup fallback (not PiP) outlives its opener: close it with the main tab
// (sign-out ends in a reload), so a shared ward device never keeps a note open.
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => useMiniWindow.getState().win?.close());
