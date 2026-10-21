import { useEffect, useState } from 'react';

import { subscribeRevisions } from '@/data/repositories/entries.repo';
import type { ClinicalDate, EntryRevision } from '@/domain/types';

/** SPEC 7.4 — the last 30 snapshots for this day, newest first. */
export function useRevisions(
  patientId: string | undefined,
  date: ClinicalDate,
  /** Also the newest autosave snapshots (the trail is open); saved versions are always included. */
  withRecent: boolean,
): EntryRevision[] {
  const [revisions, setRevisions] = useState<EntryRevision[]>([]);

  useEffect(() => {
    if (!patientId) return;
    return subscribeRevisions(
      patientId,
      date,
      setRevisions,
      (error) => console.error('[revisions] subscription failed', error),
      withRecent,
    );
  }, [patientId, date, withRecent]);

  return revisions;
}
