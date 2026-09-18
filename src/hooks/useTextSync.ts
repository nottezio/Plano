import { useCallback, useEffect, useRef, useState } from 'react';

import { mergeThreeWay, type MergeOutcome } from '@/domain/merge/threeWayMerge';
import {
  canRedo,
  canUndo,
  initHistory,
  record,
  redo as redoHistory,
  undo as undoHistory,
  type ChangeKind,
  type TextHistory,
} from '@/domain/textHistory';
import { useDrafts } from '@/store/useDrafts';
import { useUI } from '@/store/useUI';

/** SPEC 7.2 step 2. */
const IDLE_DEBOUNCE_MS = 800;
const MAX_UNSAVED_MS = 15_000;
/** How many un-echoed writes to remember. Two or three are ever in flight. */
const PENDING_CAP = 8;

export type SnapshotReason = 'pre-conflict' | 'restore';

export interface TextSyncOptions {
  /** Stable identity for the draft, e.g. `patientId|date` or `doc|documentId`. */
  key: string;
  /** The body as the server currently holds it. */
  serverText: string;
  locked: boolean;
  write: (text: string) => Promise<void>;
  /**
   * Optional durability hook, called BEFORE a conflict resolution or restore
   * lands. Entries use it to append to the revision trail; anything without a
   * trail simply omits it.
   */
  snapshot?: (text: string, reason: SnapshotReason) => void;
}

export interface TextSyncState {
  value: string;
  setValue: (next: string) => void;
  /**
   * Undo/redo over THIS note, kept by the app.
   *
   * See `domain/textHistory`: the browser's own history does not survive the
   * programmatic changes this editor makes, which is every interesting one.
   */
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** The editor hands over its textarea, so undo can put the caret back. */
  registerEditor: (node: HTMLTextAreaElement | null) => void;
  /**
   * Classify the change about to be made. A transform (Rapikan, a template,
   * carry-forward, an AI rewrite) is always its own undo step instead of
   * merging into the typing around it.
   */
  markNextChange: (kind: ChangeKind) => void;
  flush: () => void;
  dirty: boolean;
  remoteChangedWhileDirty: boolean;
  conflict: Extract<MergeOutcome, { kind: 'conflict' }> | null;
  resolveConflict: (text: string) => void;
  restoreTo: (text: string) => void;
  adoptRemote: () => void;
}

/**
 * SPEC 7.2 — the local write path, extracted so every editable body in the app
 * gets the same guarantees.
 *
 * SOAP entries and documents are the same problem: a free-form string that must
 * survive a dropped connection, a backgrounded tab, and a second device. When
 * only entries had this machinery, documents were one copy-paste away from
 * quietly having weaker durability than the notes beside them — so the
 * machinery moved here rather than being duplicated.
 *
 * Ordering, which is the whole point:
 *   1. Keystrokes update the draft store synchronously; nothing awaits.
 *   2. Write 800 ms after typing stops, and force it on blur, unmount,
 *      `visibilitychange`, `pagehide`, `beforeunload`, and after 15 s of
 *      continuous typing — someone who types for two minutes straight and then
 *      drops the phone must not lose two minutes.
 *   3. Firestore's own queue handles retry. No custom queue.
 *
 * Remote adoption is conditional: a snapshot overwrites the editor only when
 * this device has nothing unsaved. Otherwise the two versions go through
 * `mergeThreeWay`, and an unresolvable merge is handed to the UI untouched.
 */
export function useTextSync({
  key,
  serverText,
  locked,
  write,
  snapshot,
}: TextSyncOptions): TextSyncState {
  const draft = useDrafts((state) => state.drafts[key]);
  const base = useDrafts((state) => state.bases[key]);
  const setDraft = useDrafts((state) => state.setDraft);
  const setBase = useDrafts((state) => state.setBase);

  const markDirty = useUI((state) => state.markDirty);
  const markClean = useUI((state) => state.markClean);

  /**
   * Bodies this device has written and not yet seen echoed back.
   *
   * Firestore replays every local write through `onSnapshot`, so a saved body
   * arrives as a "new" server value a moment after we sent it. Without this
   * set, that echo is indistinguishable from another device's edit — and the
   * merge treats our own text as a remote change.
   */
  const pending = useRef<Set<string>>(new Set());
  const isOwnEcho = pending.current.has(serverText);

  const value = draft ?? serverText;

  /*
    History of this note, per key. A ref because a keystroke must not re-render
    for the sake of the stack; `historyVersion` exists only so the two buttons
    can enable and disable themselves.
  */
  const history = useRef<TextHistory>(initHistory(value));
  const historyKey = useRef(key);
  const [historyVersion, setHistoryVersion] = useState(0);
  /** Set while applying an undo, so the change is not recorded as a new step. */
  const applyingStep = useRef(false);
  /** How to classify the next change; reset to typing after every record. */
  const nextKind = useRef<ChangeKind>('type');
  /** The editor's textarea, registered by the editor, for caret restoration. */
  const editorNode = useRef<HTMLTextAreaElement | null>(null);
  const dirty = draft !== undefined && draft !== serverText;
  const remoteChangedWhileDirty =
    dirty && !isOwnEcho && base !== undefined && base !== serverText;

  const [conflict, setConflict] = useState<Extract<
    MergeOutcome,
    { kind: 'conflict' }
  > | null>(null);

  const timerRef = useRef(0);
  const firstDirtyAtRef = useRef(0);
  // Refs so window-level handlers always see current values without
  // re-subscribing on every keystroke.
  const latest = useRef({ value, dirty, locked, key, write, serverText });
  latest.current = { value, dirty, locked, key, write, serverText };

  const flush = useCallback(() => {
    const current = latest.current;
    window.clearTimeout(timerRef.current);
    firstDirtyAtRef.current = 0;

    if (!current.dirty || current.locked) return;

    /**
     * The base is NOT advanced here.
     *
     * It used to be, and that was a race with a bite: between `setBase(value)`
     * and the write echoing back through `onSnapshot`, `serverText` still held
     * the OLD body. So `base !== serverText` while dirty — the exact condition
     * for "someone else edited this" — and the merge ran with `local === base`,
     * producing a `remote-only` outcome that adopted the old body and undid the
     * keystroke. When the ranges overlapped instead, the conflict dialog
     * appeared and vanished a frame later.
     *
     * The base now advances only when the echo actually arrives, which is the
     * only moment we know the server has our text.
     */
    pending.current.add(current.value);
    // Bounded: only the most recent writes can still be in flight, and an
    // unbounded set would keep every keystroke alive for the session.
    if (pending.current.size > PENDING_CAP) {
      const oldest = pending.current.values().next().value;
      if (oldest !== undefined) pending.current.delete(oldest);
    }

    void current.write(current.value).catch((error: unknown) => {
      console.error('[textsync] write rejected', error);
    });
  }, []);

  const setValue = useCallback(
    (next: string) => {
      setDraft(key, next);

      /**
       * The ref is brought forward HERE, not left to the next render.
       *
       * `latest` is reassigned during render, and `setDraft` is a store write
       * that does not render synchronously. So a caller doing
       *
       *     editor.setValue(body);
       *     editor.flush();
       *
       * in one tick reached `flush` with the PREVIOUS value still in the ref —
       * and, worse, with the previous `dirty`, which for an empty day is
       * `false`. `flush` returns early on `!dirty`, so it wrote nothing at all
       * AND cleared the debounce timer on its way out, cancelling the write
       * that `setValue` had just scheduled.
       *
       * That is "Salin dari hari sebelumnya needs two clicks": the first click
       * reported success, saved nothing, and left the draft only in local
       * state; the second click found `dirty` true from the first and finally
       * wrote. Every same-tick set-then-flush caller had the same hole, not
       * just this one — which is why it is fixed here rather than at the call
       * site.
       */
      latest.current = {
        ...latest.current,
        value: next,
        dirty: next !== latest.current.serverText,
      };

      if (firstDirtyAtRef.current === 0) firstDirtyAtRef.current = Date.now();

      window.clearTimeout(timerRef.current);
      if (Date.now() - firstDirtyAtRef.current >= MAX_UNSAVED_MS) {
        // Continuous typing: stop waiting for an idle gap that may never come.
        flush();
        return;
      }
      timerRef.current = window.setTimeout(flush, IDLE_DEBOUNCE_MS);
    },
    [key, setDraft, flush],
  );

  /*
    Record every change to the note: typed, transformed, or arrived from
    another device. Reading the caret from the live textarea is what lets undo
    put it back where the edit was, without every call site passing it.
  */
  useEffect(() => {
    if (historyKey.current !== key) {
      historyKey.current = key;
      history.current = initHistory(value);
      setHistoryVersion((current) => current + 1);
      return;
    }
    if (applyingStep.current) {
      applyingStep.current = false;
      return;
    }
    const node = editorNode.current;
    const selection =
      node && document.activeElement === node
        ? { start: node.selectionStart, end: node.selectionEnd }
        : null;
    const next = record(
      history.current,
      { value, selection },
      nextKind.current,
      Date.now(),
    );
    nextKind.current = 'type';
    if (next === history.current) return;
    history.current = next;
    setHistoryVersion((current) => current + 1);
  }, [value, key]);

  const applyStep = useCallback(
    (step: { value: string; selection: { start: number; end: number } | null }) => {
      applyingStep.current = true;
      setDraft(key, step.value);
      latest.current = {
        ...latest.current,
        value: step.value,
        dirty: step.value !== latest.current.serverText,
      };
      setHistoryVersion((current) => current + 1);
      // Saved like any other change: an undo left unsaved is an undo that
      // comes back on the next device.
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(flush, IDLE_DEBOUNCE_MS);

      const node = editorNode.current;
      if (!node) return;
      // After React has painted the restored value, or the offsets would be
      // applied to the text being replaced.
      window.requestAnimationFrame(() => {
        node.focus();
        const at = step.selection ?? { start: step.value.length, end: step.value.length };
        node.setSelectionRange(at.start, at.end);
      });
    },
    [key, setDraft, flush],
  );

  const undoStep = useCallback(() => {
    if (latest.current.locked) return;
    const result = undoHistory(history.current);
    if (!result) return;
    history.current = result.history;
    applyStep(result.step);
  }, [applyStep]);

  const redoStep = useCallback(() => {
    if (latest.current.locked) return;
    const result = redoHistory(history.current);
    if (!result) return;
    history.current = result.history;
    applyStep(result.step);
  }, [applyStep]);

  const adoptRemote = useCallback(() => {
    // Its own undo step: text replaced by another device's is exactly the
    // change someone reaches for Ctrl+Z after.
    nextKind.current = 'external';
    setDraft(key, serverText);
    setBase(key, serverText);
  }, [key, serverText, setDraft, setBase]);

  /**
   * The echo landed: the server now holds text this device wrote, so that text
   * is the new common ancestor. Nothing to merge.
   */
  useEffect(() => {
    if (!isOwnEcho) return;
    pending.current.delete(serverText);
    if (base !== serverText) setBase(key, serverText);
  }, [isOwnEcho, serverText, base, key, setBase]);

  /** SPEC 7.2 step 5 — merge whenever the server moves under unsaved text. */
  useEffect(() => {
    if (!remoteChangedWhileDirty) {
      setConflict(null);
      return;
    }

    const outcome = mergeThreeWay(base ?? null, value, serverText);

    if (outcome.kind === 'conflict') {
      setConflict(outcome);
      return;
    }

    setConflict(null);
    if (outcome.body !== value) {
      nextKind.current = 'external';
      setDraft(key, outcome.body);
    }
    setBase(key, serverText);
  }, [remoteChangedWhileDirty, serverText, base, key, setDraft, setBase, value]);

  /**
   * SPEC 7.4 — snapshot BOTH versions before applying a resolution.
   * Before the write, not after: if the app dies in between, the losing version
   * must already be recoverable.
   */
  const resolveConflict = useCallback(
    (text: string) => {
      const current = latest.current;
      snapshot?.(current.value, 'pre-conflict');
      snapshot?.(serverText, 'pre-conflict');

      setConflict(null);
      setDraft(current.key, text);
      setBase(current.key, serverText);
    },
    [serverText, setDraft, setBase, snapshot],
  );

  /**
   * Restoring is itself undoable: the current text is snapshotted first.
   *
   * The ref is brought forward here for the same reason `setValue` does it —
   * a caller doing `restoreTo(body); flush();` in one tick would otherwise
   * flush the text being REPLACED, or see `dirty` false and write nothing at
   * all. Restoring a revision and applying a pasted revision both do exactly
   * that, and the second is the one that saves without waiting for the idle
   * debounce.
   */
  const restoreTo = useCallback(
    (text: string) => {
      const current = latest.current;
      snapshot?.(current.value, 'restore');
      setDraft(current.key, text);
      latest.current = {
        ...latest.current,
        value: text,
        dirty: text !== latest.current.serverText,
      };
    },
    [setDraft, snapshot],
  );

  // Seed the merge base the first time this key is seen on this device.
  useEffect(() => {
    if (base === undefined && serverText.length > 0) setBase(key, serverText);
  }, [base, key, serverText, setBase]);

  // Drop a draft that has caught up with the server, so a later snapshot from
  // another device is adopted rather than fought by a stale local copy.
  useEffect(() => {
    if (draft !== undefined && draft === serverText) {
      useDrafts.getState().clearDraft(key);
    }
  }, [draft, serverText, key]);

  // Let the update banner save this editor rather than refusing to reload.
  const registerFlush = useUI((state) => state.registerFlush);
  useEffect(() => registerFlush(key, flush), [key, flush, registerFlush]);

  // SPEC 17 — the service-worker update gate reads this.
  useEffect(() => {
    if (dirty) markDirty(key);
    else markClean(key);
    return () => markClean(key);
  }, [dirty, key, markDirty, markClean]);

  useEffect(() => {
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') flush();
    };
    const onPageHide = (): void => flush();
    const onBeforeUnload = (): void => flush();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
      // Unmount = route change. Flush before the component disappears.
      flush();
    };
  }, [flush]);

  // `historyVersion` is read so the memo below recomputes when the stack
  // moves; the number itself means nothing.
  void historyVersion;

  return {
    value,
    setValue,
    flush,
    dirty,
    remoteChangedWhileDirty,
    conflict,
    resolveConflict,
    restoreTo,
    adoptRemote,
    undo: undoStep,
    redo: redoStep,
    canUndo: canUndo(history.current),
    canRedo: canRedo(history.current),
    registerEditor: (node: HTMLTextAreaElement | null) => {
      editorNode.current = node;
    },
    markNextChange: (kind: ChangeKind) => {
      nextKind.current = kind;
    },
  };
}
