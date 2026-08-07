import { useCallback, useMemo, useRef } from 'react';

import { appendRevision, writeBody } from '@/data/repositories/entries.repo';
import { draftKey } from '@/store/useDrafts';
import { useTextSync, type SnapshotReason, type TextSyncState } from './useTextSync';
import type { ClinicalDate, DailyEntry } from '@/domain/types';

/** One snapshot per five minutes of editing (SPEC 7.4). */
const REVISION_INTERVAL_MS = 5 * 60_000;

export type BodyEditorState = TextSyncState & {
  /** Alias kept for readability at the call site. */
  restoreRevision: (body: string) => void;
};

/**
 * SPEC 7.2 — the SOAP body editor.
 *
 * All of the durability machinery lives in `useTextSync`; this adds the two
 * things specific to a clinical day: the entry write (which carries
 * `hariRawat` and the creation-only fields) and the revision trail that every
 * conflict resolution and restore is snapshotted into first.
 */
export function useBodyEditor({
  patientId,
  date,
  entry,
  exists,
  hariRawat,
  locked,
}: {
  patientId: string;
  date: ClinicalDate;
  entry: DailyEntry | null;
  exists: boolean;
  hariRawat: number;
  locked: boolean;
}): BodyEditorState {
  const key = draftKey(patientId, date);

  /**
   * SPEC 7.4 — periodic snapshots.
   *
   * The revision trail declared an `autosave` reason from the start, and
   * nothing ever wrote one: revisions were only appended on conflict
   * resolution and restore. On a single device neither ever happens, so the
   * trail was permanently empty and the feature looked broken because it was.
   *
   * A snapshot is taken of the body being REPLACED, not the one being written —
   * the point of a trail is to recover what you had, and what you are about to
   * save is already safe.
   *
   * Throttled to one every five minutes. Snapshotting each 800 ms autosave
   * would burn through the 30-entry cap in under a minute and leave a trail
   * covering only the last few keystrokes, which is precisely the window you
   * never need to recover.
   */
  const lastSnapshot = useRef<{ at: number; body: string }>({ at: 0, body: '' });

  const write = useCallback(
    (body: string) => {
      const previous = entry?.body ?? '';
      const now = Date.now();
      const stale = now - lastSnapshot.current.at >= REVISION_INTERVAL_MS;

      if (
        previous.trim().length > 0 &&
        previous !== body &&
        previous !== lastSnapshot.current.body &&
        stale
      ) {
        lastSnapshot.current = { at: now, body: previous };
        void appendRevision(patientId, date, {
          body: previous,
          rev: entry?.rev ?? 0,
          reason: 'autosave',
        }).catch((error: unknown) => console.error('[editor] autosave snapshot failed', error));
      }

      return writeBody(patientId, date, body, hariRawat, { isNew: !exists });
    },
    [patientId, date, hariRawat, exists, entry?.body, entry?.rev],
  );

  const snapshot = useCallback(
    (body: string, reason: SnapshotReason) => {
      void appendRevision(patientId, date, {
        body,
        rev: entry?.rev ?? 0,
        reason,
      }).catch((error: unknown) => console.error('[editor] snapshot failed', error));
    },
    [patientId, date, entry?.rev],
  );

  const sync = useTextSync({
    key,
    serverText: entry?.body ?? '',
    locked,
    write,
    snapshot,
  });

  return useMemo(() => ({ ...sync, restoreRevision: sync.restoreTo }), [sync]);
}
