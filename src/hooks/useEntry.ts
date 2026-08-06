import { useEffect, useState } from 'react';

import { subscribeEntry, subscribeEntryDates } from '@/data/repositories/entries.repo';
import type { ClinicalDate, DailyEntry } from '@/domain/types';

export interface EntryResult {
  entry: DailyEntry | null;
  exists: boolean;
  loading: boolean;
  hasPendingWrites: boolean;
}

export function useEntry(patientId: string | undefined, date: ClinicalDate): EntryResult {
  const [result, setResult] = useState<EntryResult>({
    entry: null,
    exists: false,
    loading: true,
    hasPendingWrites: false,
  });

  useEffect(() => {
    if (!patientId) return;
    setResult((current) => ({ ...current, loading: true }));

    return subscribeEntry(
      patientId,
      date,
      (snapshot) =>
        setResult({
          entry: snapshot.entry,
          exists: snapshot.exists,
          loading: false,
          hasPendingWrites: snapshot.hasPendingWrites,
        }),
      (error) => {
        console.error('[entry] subscription failed', error);
        setResult((current) => ({ ...current, loading: false }));
      },
    );
  }, [patientId, date]);

  return result;
}

/** Dates that already have a page — marks the date rail (SPEC F4). */
export function useEntryDates(patientId: string | undefined): ClinicalDate[] {
  const [dates, setDates] = useState<ClinicalDate[]>([]);

  useEffect(() => {
    if (!patientId) return;
    return subscribeEntryDates(
      patientId,
      setDates,
      (error) => console.error('[entry] date list failed', error),
    );
  }, [patientId]);

  return dates;
}
