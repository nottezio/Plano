import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { setPatientBookmark } from '@/data/repositories/patients.repo';
import {
  bookmarkOnLine,
  lineAt,
  reanchorBookmarks,
  resolveBookmarks,
  type BookmarkMap,
  type LineBookmark,
  type ResolvedBookmark,
} from '@/domain/bookmarks';

/** How long typing in a bookmarked line waits before its new text is written. */
const FOLLOW_DELAY_MS = 1200;

/**
 * The patient's line bookmarks, resolved against the note on screen.
 *
 * Local changes are applied at once and written behind (`pending`), because a
 * bookmark that is being followed through an edit must keep resolving on the
 * very next keystroke. Waiting for the server's echo would leave a window in
 * which the stored text no longer matches the line, and the next keystroke's
 * re-anchor would find nothing to follow — the bookmark would drop off the
 * first time somebody typed two characters into its line.
 *
 * Re-anchoring runs only for an edit of the SAME note (same patient, same
 * day). Switching days swaps the whole body, and mapping offsets across two
 * different notes would move bookmarks onto unrelated lines.
 */
export function useLineBookmarks({
  patientId,
  stored,
  body,
  date,
  enabled,
}: {
  patientId: string | null;
  stored: BookmarkMap | undefined;
  body: string;
  date: string;
  /** Off while the note is still loading or another editor is open. */
  enabled: boolean;
}): {
  resolved: ResolvedBookmark[];
  missing: string[];
  /** Bookmark the caret's line, or remove the bookmark already on it. */
  toggleAt: (offset: number) => void;
  /** Remove every bookmark whose line is not in this note. */
  clearMissing: () => void;
} {
  type Pending = Record<string, LineBookmark | null>;
  const [pending, setPendingState] = useState<Pending>({});
  /*
    The same map, readable synchronously.

    Re-anchoring chains: keystroke 2 has to see what keystroke 1 moved the
    bookmark to. State alone could not guarantee that. The move is set from an
    effect, and a fast second keystroke is a discrete update React renders
    BEFORE that lower-priority state lands — so the second pass saw the old
    text, found nothing at the old line, and the bookmark fell off after one
    character (caught in the render check, typing " koreksi" into a marked
    line). The ref is updated in the same tick as the move, so the next pass
    reads it whatever React has or has not rendered yet.
  */
  const pendingRef = useRef<Pending>({});
  const setPending = useCallback((update: (current: Pending) => Pending) => {
    pendingRef.current = update(pendingRef.current);
    setPendingState(pendingRef.current);
  }, []);
  const merge = useCallback(
    (map: Pending): BookmarkMap => {
      const merged: Record<string, LineBookmark> = { ...(stored ?? {}) };
      for (const [id, value] of Object.entries(map)) {
        if (value) merged[id] = value;
        else delete merged[id];
      }
      return merged;
    },
    [stored],
  );

  // A patient switch starts clean: pending edits belong to the old one, and
  // were already flushed by the effect below.
  const [pendingFor, setPendingFor] = useState(patientId);
  if (pendingFor !== patientId) {
    setPendingFor(patientId);
    pendingRef.current = {};
    setPendingState({});
  }

  const effective = useMemo<BookmarkMap>(() => merge(pending), [merge, pending]);

  /*
    Drop pending entries the server has caught up with, so a later remote
    change to the same bookmark is not masked by a stale local copy.
  */
  useEffect(() => {
    const settled = Object.entries(pending).filter(([id, value]) => {
      const server = stored?.[id];
      return value
        ? server?.text === value.text && server.nth === value.nth
        : server === undefined;
    });
    if (settled.length === 0) return;
    setPending((current) => {
      const next = { ...current };
      // Only if it is still that value: a newer local move is not settled.
      for (const [id, value] of settled) if (next[id] === value) delete next[id];
      return next;
    });
  }, [stored, pending, setPending]);

  const write = useCallback(
    (id: string, value: LineBookmark | null) => {
      if (!patientId) return;
      void setPatientBookmark(patientId, id, value).catch((cause: unknown) => {
        console.error('[bookmarks] write failed', cause);
      });
    },
    [patientId],
  );

  /* Follow edits. */
  const previous = useRef<{ key: string; body: string } | null>(null);
  const followed = useRef<Record<string, LineBookmark>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushFollowed = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const batch = followed.current;
    followed.current = {};
    for (const [id, value] of Object.entries(batch)) write(id, value);
  }, [write]);

  useEffect(() => {
    const key = `${patientId ?? ''}|${date}`;
    const last = previous.current;
    previous.current = enabled ? { key, body } : null;
    if (!enabled || !last || last.key !== key || last.body === body) return;
    const moved = reanchorBookmarks(last.body, body, merge(pendingRef.current));
    if (Object.keys(moved).length === 0) return;
    setPending((current) => ({ ...current, ...moved }));
    followed.current = { ...followed.current, ...moved };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flushFollowed, FOLLOW_DELAY_MS);
  }, [body, date, patientId, enabled, merge, setPending, flushFollowed]);

  // Leaving the patient or the page writes what is still waiting.
  useEffect(() => flushFollowed, [patientId, flushFollowed]);

  const { resolved, missing } = useMemo(
    () => (enabled ? resolveBookmarks(body, effective) : { resolved: [], missing: [] }),
    [enabled, body, effective],
  );

  const toggleAt = useCallback(
    (offset: number) => {
      if (!enabled) return;
      const existing = bookmarkOnLine(body, effective, offset);
      if (existing) {
        setPending((current) => ({ ...current, [existing]: null }));
        delete followed.current[existing];
        write(existing, null);
        return;
      }
      const line = lineAt(body, offset);
      if (!line.text) return;
      const id = Math.random().toString(36).slice(2, 10);
      const value: LineBookmark = {
        text: line.text,
        nth: line.nth,
        createdAt: new Date().toISOString(),
      };
      setPending((current) => ({ ...current, [id]: value }));
      write(id, value);
    },
    [enabled, body, effective, write, setPending],
  );

  const clearMissing = useCallback(() => {
    if (missing.length === 0) return;
    setPending((current) => {
      const next = { ...current };
      for (const id of missing) next[id] = null;
      return next;
    });
    for (const id of missing) write(id, null);
  }, [missing, write, setPending]);

  return { resolved, missing, toggleAt, clearMissing };
}
