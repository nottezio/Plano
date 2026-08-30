import { useEffect, useState } from 'react';

import {
  subscribeEntry,
  subscribeEntryDates,
  type EntryDatesSnapshot,
} from '@/data/repositories/entries.repo';
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

/**
 * Dates that already have a page, plus the shift notes on each.
 *
 * Both come from one subscription: the query already reads every entry
 * document, so splitting them would mean a second listener over the same data.
 */
const EMPTY_DATES: EntryDatesSnapshot = { dates: [], shiftNotesByDate: {} };

export function useEntryDates(patientId: string | undefined): EntryDatesSnapshot {
  const [snapshot, setSnapshot] = useState<EntryDatesSnapshot>(EMPTY_DATES);

  useEffect(() => {
    if (!patientId) return;
    return subscribeEntryDates(
      patientId,
      setSnapshot,
      (error) => console.error('[entry] date list failed', error),
    );
  }, [patientId]);

  return snapshot;
}
