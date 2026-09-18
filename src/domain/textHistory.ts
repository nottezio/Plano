/**
 * Undo/redo for a note, kept by the app rather than by the browser.
 *
 * WHY NOT THE BROWSER'S
 *
 * A textarea has its own history, and for plain typing it works. It does not
 * survive the things this editor actually does: inserting a template, Rapikan
 * SOAP, carry-forward, an AI rewrite, restoring a revision, or a merge
 * arriving from another device. Every one of those sets the value from React,
 * and a programmatic value assignment drops out of — or invalidates — the
 * native stack. So Ctrl+Z after "Rapikan" either did nothing or jumped past
 * the reformat to some older state, which is the definition of an undo you
 * cannot rely on.
 *
 * WHAT IT GUARANTEES
 *
 *   - Every change to the note is a step: typed, transformed, or arrived.
 *   - Typing coalesces into one step per burst, so undo goes back a phrase at
 *     a time rather than a character at a time.
 *   - A TRANSFORM is always its own step, never merged into the typing around
 *     it. Undo after Rapikan restores exactly the note before Rapikan.
 *   - Redo survives until the next real edit, then is dropped: keeping a
 *     future that no longer follows from the present is how a redo button
 *     resurrects text nobody expected.
 */

export interface HistoryStep {
  value: string;
  /** Caret at the time, so undo puts it back where the edit happened. */
  selection: { start: number; end: number } | null;
}

export type ChangeKind =
  /** Ordinary keystrokes. Coalesces within `COALESCE_MS`. */
  | 'type'
  /** A whole-note change the user asked for. Never coalesces. */
  | 'transform'
  /** A change that arrived from elsewhere (a merge, a remote adopt). */
  | 'external';

export interface TextHistory {
  past: HistoryStep[];
  present: HistoryStep;
  future: HistoryStep[];
  lastAt: number;
  lastKind: ChangeKind;
}

/** A burst of typing is one step. Long enough to cover thinking mid-sentence. */
export const COALESCE_MS = 900;

/**
 * Steps kept. A long note is a few KB, so a hundred steps is a few hundred KB
 * at worst, held for one open editor.
 */
export const HISTORY_CAP = 100;

export function initHistory(value: string): TextHistory {
  return {
    past: [],
    present: { value, selection: null },
    future: [],
    lastAt: 0,
    lastKind: 'external',
  };
}

export function record(
  history: TextHistory,
  step: HistoryStep,
  kind: ChangeKind,
  at: number,
): TextHistory {
  // Not a change: the same text recorded twice is a step that undoes nothing,
  // and a stack full of those makes undo look broken.
  if (step.value === history.present.value) return history;

  const coalesce =
    kind === 'type' && history.lastKind === 'type' && at - history.lastAt < COALESCE_MS;

  if (coalesce) {
    // Replace the present without deepening the stack: the burst keeps the
    // state it started from, so one undo returns to before the burst.
    return { ...history, present: step, future: [], lastAt: at, lastKind: kind };
  }

  const past = [...history.past, history.present].slice(-HISTORY_CAP);
  return { past, present: step, future: [], lastAt: at, lastKind: kind };
}

export function canUndo(history: TextHistory): boolean {
  return history.past.length > 0;
}

export function canRedo(history: TextHistory): boolean {
  return history.future.length > 0;
}

export function undo(history: TextHistory): { history: TextHistory; step: HistoryStep } | null {
  const previous = history.past.at(-1);
  if (!previous) return null;
  return {
    history: {
      past: history.past.slice(0, -1),
      present: previous,
      future: [history.present, ...history.future].slice(0, HISTORY_CAP),
      // Reset so the next keystroke cannot merge into the step just restored.
      lastAt: 0,
      lastKind: 'external',
    },
    step: previous,
  };
}

export function redo(history: TextHistory): { history: TextHistory; step: HistoryStep } | null {
  const next = history.future[0];
  if (!next) return null;
  return {
    history: {
      past: [...history.past, history.present].slice(-HISTORY_CAP),
      present: next,
      future: history.future.slice(1),
      lastAt: 0,
      lastKind: 'external',
    },
    step: next,
  };
}
