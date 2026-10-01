import { useEffect, useReducer } from 'react';

import {
  acquirePatients,
  readPatients,
  watchPatients,
  type PatientsResult,
} from '@/data/patientsFeed';
import type { PatientStatus } from '@/domain/types';
import { useSession } from '@/store/useSession';

export type { PatientsResult };

/**
 * One live query for a patient list, SHARED across screens and kept alive
 * between visits — see `data/patientsFeed` for why (the board used to show
 * "Memuat…" every time it was returned to).
 *
 * Everything a card needs — colour, progress, preview — comes from the patient
 * document via the derived caches (see types.ts). Per-patient listeners for
 * entries and checklists would be 2N streams for a screen showing four lines
 * per patient.
 */
export function usePatients(status: PatientStatus, enabled = true): PatientsResult {
  const uid = useSession((state) => state.user?.uid ?? null);
  const [, refresh] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    if (!uid || !enabled) return undefined;
    const release = acquirePatients(uid, status);
    const unwatch = watchPatients(uid, status, refresh);
    // The feed may already hold a newer result than the one this render read.
    refresh();
    return () => {
      unwatch();
      release();
    };
  }, [uid, status, enabled]);

  return readPatients(uid, status, enabled);
}
