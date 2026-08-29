import { useEffect, useRef, useState } from 'react';

import { subscribePatients } from '@/data/repositories/patients.repo';
import type { Patient, PatientStatus } from '@/domain/types';
import { useSession } from '@/store/useSession';

export interface PatientsResult {
  patients: Patient[];
  loading: boolean;
  fromCache: boolean;
  error: string | null;
}

/**
 * Backoff for reattaching a dead listener.
 *
 * Capped and jittered rather than unbounded: a ward wifi dropout affects every
 * device on the round at once, and an uncapped retry from all of them arrives
 * at Firestore as a thundering herd the moment the access point returns.
 */
const RETRY_MS = [1_000, 2_000, 5_000, 10_000, 30_000] as const;

/**
 * One live query for the whole board.
 *
 * Everything a card needs — colour, progress, preview — comes from the patient
 * document via the derived caches (see types.ts). Per-patient listeners for
 * entries and checklists would be 2N streams for a screen showing four lines
 * per patient.
 */
export function usePatients(status: PatientStatus, enabled = true): PatientsResult {
  const uid = useSession((state) => state.user?.uid ?? null);
  const [result, setResult] = useState<PatientsResult>({
    patients: [],
    loading: true,
    fromCache: true,
    error: null,
  });

  /**
   * The last list we successfully held, kept across a failed reattach.
   *
   * In state it would be clobbered by the error branch; in a ref it survives,
   * which is the whole point — see the comment on the error handler.
   */
  const lastGood = useRef<Patient[]>([]);

  useEffect(() => {
    // `enabled` was previously in this dependency array and read nowhere, so
    // the caller could not actually turn the subscription off. Either honour
    // it or delete it; a flag that silently does nothing is worse than both.
    if (!uid || !enabled) {
      setResult({ patients: [], loading: false, fromCache: true, error: null });
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    setResult((current) => ({ ...current, loading: true }));

    const attach = (): void => {
      if (cancelled) return;

      unsubscribe = subscribePatients(
        uid,
        status,
        (snapshot) => {
          if (cancelled) return;
          attempt = 0;
          lastGood.current = snapshot.patients;
          setResult({
            patients: snapshot.patients,
            loading: false,
            fromCache: snapshot.fromCache,
            error: null,
          });
        },
        (error) => {
          if (cancelled) return;

          // A missing composite index shows up here and nowhere else. Never
          // swallow it: the board would just look permanently empty.
          console.error('[board] patient query failed', error);

          /**
           * The patients we already have are KEPT.
           *
           * This used to set `patients: []`, which turned a transient network
           * fault into an empty board under a red banner — the counts read
           * "Pasien saya (0)" while the cache still held every one of them.
           * Offline-first is not a property of the data layer alone; a hook
           * that discards good data the moment a stream hiccups undoes it.
           *
           * The error still shows, because a board silently frozen on an old
           * list is its own hazard on a round. Stale-and-labelled beats empty.
           */
          setResult({
            patients: lastGood.current,
            loading: false,
            fromCache: true,
            error: 'Gagal memuat daftar pasien. Mencoba menyambung ulang…',
          });

          /**
           * Reattach. This is the actual fix for "occurs sometimes".
           *
           * Firestore's error callback does not mean "this snapshot failed",
           * it means THE LISTENER IS DEAD — it will never fire again. The
           * previous version rendered the error and stopped, so any recoverable
           * condition (token refresh, wifi handover between wards, a phone
           * waking from sleep) became permanent until the route was remounted.
           * That is why it looked random, and why navigating away "fixed" it.
           */
          unsubscribe?.();
          unsubscribe = null;
          const delay = RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)] ?? 30_000;
          attempt += 1;
          timer = setTimeout(attach, delay + Math.random() * 500);
        },
      );
    };

    attach();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribe?.();
    };
  }, [uid, status, enabled]);

  return result;
}
