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

const LOADING: EntryResult = { entry: null, exists: false, loading: true, hasPendingWrites: false };

/**
 * One day's entry, TAGGED with the (patient, date) it belongs to.
 *
 * The result used to be plain state. On the render right after the date (or
 * patient) changed, it still held the PREVIOUS day's entry with
 * `loading: false`, because the effect that resets it runs after that render.
 * Everything downstream read it as the new day's note for one render: the
 * editor seeded the new day's merge base with the old day's text (a spurious
 * conflict on the first keystroke), undo history started from the other day,
 * and the card heal wrote an older assessment under the latest date. A
 * result for another key is now reported as "loading", in the same render.
 */
export function useEntry(patientId: string | undefined, date: ClinicalDate): EntryResult {
  const key = `${patientId ?? ''}|${date}`;
  const [tagged, setTagged] = useState<{ key: string; result: EntryResult }>({
    key: '',
    result: LOADING,
  });

  useEffect(() => {
    if (!patientId) return;

    return subscribeEntry(
      patientId,
      date,
      (snapshot) =>
        setTagged({
          key,
          result: {
            entry: snapshot.entry,
            exists: snapshot.exists,
            loading: false,
            hasPendingWrites: snapshot.hasPendingWrites,
          },
        }),
      (error) => {
        console.error('[entry] subscription failed', error);
        setTagged({ key, result: { ...LOADING, loading: false } });
      },
    );
  }, [patientId, date, key]);

  return tagged.key === key ? tagged.result : LOADING;
}

/**
 * Dates that already have a page, plus the shift notes on each.
 *
 * Both come from one subscription: the query already reads every entry
 * document, so splitting them would mean a second listener over the same data.
 */
const EMPTY_DATES: EntryDatesSnapshot = {
  dates: [],
  datesWithBody: [],
  shiftNotesByDate: {},
};

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
