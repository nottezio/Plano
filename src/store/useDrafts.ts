import { create } from 'zustand';

/**
 * SPEC 7.2 step 1 — keystrokes land here first, synchronously.
 *
 * Drafts are keyed by (patient, date) and survive route changes, so navigating
 * away mid-sentence and back never loses characters even before the debounce
 * has fired. This store is the only thing between a keystroke and the screen;
 * nothing in it may await anything.
 */
export type DraftKey = string;

export function draftKey(patientId: string, date: string): DraftKey {
  return `${patientId}|${date}`;
}

interface DraftsState {
  drafts: Readonly<Record<DraftKey, string>>;
  /** Last body this device knows the server holds, per key. */
  bases: Readonly<Record<DraftKey, string>>;
  setDraft: (key: DraftKey, body: string) => void;
  setBase: (key: DraftKey, body: string) => void;
  clearDraft: (key: DraftKey) => void;
}

export const useDrafts = create<DraftsState>((set) => ({
  drafts: {},
  bases: {},
  setDraft: (key, body) => set((state) => ({ drafts: { ...state.drafts, [key]: body } })),
  setBase: (key, body) => set((state) => ({ bases: { ...state.bases, [key]: body } })),
  clearDraft: (key) =>
    set((state) => {
      const { [key]: _removed, ...rest } = state.drafts;
      return { drafts: rest };
    }),
}));
