import { useCallback, useEffect, useRef, useState } from 'react';

import { mergeThreeWay, type MergeOutcome } from '@/domain/merge/threeWayMerge';
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
  const latest = useRef({ value, dirty, locked, key, write });
  latest.current = { value, dirty, locked, key, write };

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

  const adoptRemote = useCallback(() => {
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
    if (outcome.body !== value) setDraft(key, outcome.body);
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

  /** Restoring is itself undoable: the current text is snapshotted first. */
  const restoreTo = useCallback(
    (text: string) => {
      const current = latest.current;
      snapshot?.(current.value, 'restore');
      setDraft(current.key, text);
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
  };
}
