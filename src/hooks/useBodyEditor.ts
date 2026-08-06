import { useCallback, useMemo } from 'react';

import { appendRevision, writeBody } from '@/data/repositories/entries.repo';
import { draftKey } from '@/store/useDrafts';
import { useTextSync, type SnapshotReason, type TextSyncState } from './useTextSync';
import type { ClinicalDate, DailyEntry } from '@/domain/types';

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

  const write = useCallback(
    (body: string) => writeBody(patientId, date, body, hariRawat, { isNew: !exists }),
    [patientId, date, hariRawat, exists],
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
