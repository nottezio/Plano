import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { deleteSensusInput, subscribeSensusInput, writeSensusInput } from '@/data/repositories/sensusInput.repo';
import { hasContent, type SensusDay, type SensusStore } from '@/domain/census/makerStore';
import { dayPatch, expiredDates, mergeRemoteDays, tooBigToSync } from '@/domain/census/makerSync';
import type { ClinicalDate } from '@/domain/types';

/** Typing in a list box writes once it pauses, not per keystroke. */
const WRITE_DELAY_MS = 1200;

export type SensusSyncStatus = 'off' | 'waiting' | 'synced' | 'error';

/**
 * Keeps Buat Sensus's per-day input in step with the account (12.6).
 *
 * - `synced` (ref) = what the account holds, per date: the base each write is
 *   diffed against, so only changed leaves are sent.
 * - A date with a write waiting is DIRTY: a snapshot never overwrites it (the
 *   echo of an older write would otherwise undo the last few keystrokes).
 * - Nothing is uploaded before the first server-confirmed snapshot: an empty
 *   cache means "not known yet", not "the account is empty" (as `useJagaSync`).
 * - Waiting writes are flushed on unmount and when the page is hidden, so
 *   leaving the tab mid-paste does not lose the last second of typing.
 */
export function useSensusInputSync(
  uid: string | null,
  store: SensusStore,
  setStore: Dispatch<SetStateAction<SensusStore>>,
  today: ClinicalDate,
): { status: SensusSyncStatus; tooBig: string[] } {
  const [status, setStatus] = useState<SensusSyncStatus>('off');
  const [tooBig, setTooBig] = useState<string[]>([]);
  const synced = useRef<Record<string, SensusDay>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const ready = useRef(false);
  const storeRef = useRef(store);
  storeRef.current = store;

  /** Write one date now: its changed leaves, or a delete if it was emptied. */
  const flushDate = useRef<(date: string) => void>(() => undefined);
  flushDate.current = (date: string): void => {
    const timer = timers.current.get(date);
    if (timer !== undefined) clearTimeout(timer);
    timers.current.delete(date);
    if (!uid) return;
    const next = storeRef.current.days[date];
    const prev = synced.current[date];
    if (!next || !hasContent(next)) {
      if (prev) {
        delete synced.current[date];
        void deleteSensusInput(uid, date).catch((error: unknown) => console.error('[sensus] delete rejected', error));
      }
      return;
    }
    if (tooBigToSync(next)) {
      setTooBig((current) => (current.includes(date) ? current : [...current, date]));
      return;
    }
    setTooBig((current) => (current.includes(date) ? current.filter((d) => d !== date) : current));
    const patch = dayPatch(prev, next);
    if (!patch) return;
    synced.current[date] = next;
    void writeSensusInput(uid, date, patch).catch((error: unknown) => {
      console.error('[sensus] write rejected', error);
      setStatus('error');
    });
  };

  const flushAll = useRef((): void => undefined);
  flushAll.current = (): void => {
    for (const date of [...timers.current.keys()]) flushDate.current(date);
  };

  // The account → this device.
  useEffect(() => {
    ready.current = false;
    synced.current = {};
    if (!uid) {
      setStatus('off');
      return undefined;
    }
    setStatus('waiting');
    const unsubscribe = subscribeSensusInput(
      uid,
      ({ days, fromCache, pending }) => {
        // Our own write on its way: the local copy is already ahead of it.
        if (pending) return;
        const dirty = new Set(timers.current.keys());
        if (fromCache && !ready.current) {
          // What this device last saw of the account: fill in, never remove.
          setStore((current) => mergeRemoteDays(current, days, dirty, new Set(), today));
          return;
        }
        const known = new Set(Object.keys(synced.current));
        synced.current = { ...days };
        setStore((current) => mergeRemoteDays(current, days, dirty, known, today));
        if (!ready.current) {
          ready.current = true;
          // Days kept here before 12.6 (or typed offline) and missing from the
          // account are uploaded once by the store effect below.
          setStore((current) => ({ ...current }));
        }
        for (const date of expiredDates(Object.keys(days), today)) {
          delete synced.current[date];
          void deleteSensusInput(uid, date).catch(() => undefined);
        }
        setStatus('synced');
      },
      (error) => {
        console.error('[sensus] listener failed', error);
        setStatus('error');
      },
    );
    const onHide = (): void => {
      if (document.visibilityState === 'hidden') flushAll.current();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      flushAll.current();
      unsubscribe();
    };
  }, [uid, setStore, today]);

  // This device → the account, per date, once typing pauses.
  useEffect(() => {
    if (!uid || !ready.current) return;
    const dates = new Set([...Object.keys(store.days), ...Object.keys(synced.current)]);
    for (const date of dates) {
      const next = store.days[date];
      const prev = synced.current[date];
      const changed = next ? dayPatch(prev, next) !== null || (!hasContent(next) && prev) : Boolean(prev);
      if (!changed) continue;
      const timer = timers.current.get(date);
      if (timer !== undefined) clearTimeout(timer);
      timers.current.set(
        date,
        setTimeout(() => flushDate.current(date), WRITE_DELAY_MS),
      );
    }
  }, [uid, store]);

  return { status, tooBig };
}
