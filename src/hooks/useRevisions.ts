import { useEffect, useState } from 'react';

import { subscribeRevisions } from '@/data/repositories/entries.repo';
import type { ClinicalDate, EntryRevision } from '@/domain/types';

/** SPEC 7.4 — the last 30 snapshots for this day, newest first. */
export function useRevisions(
  patientId: string | undefined,
  date: ClinicalDate,
  enabled: boolean,
): EntryRevision[] {
  const [revisions, setRevisions] = useState<EntryRevision[]>([]);

  useEffect(() => {
    if (!patientId || !enabled) return;
    return subscribeRevisions(patientId, date, setRevisions, (error) =>
      console.error('[revisions] subscription failed', error),
    );
  }, [patientId, date, enabled]);

  return revisions;
}
