import { useEffect, useState } from 'react';

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
 * One live query for the whole board.
 *
 * Everything a card needs — colour, progress, preview — comes from the patient
 * document via the derived caches (see types.ts). Per-patient listeners for
 * entries and checklists would be 2N streams for a screen showing four lines
 * per patient.
 */
export function usePatients(status: PatientStatus): PatientsResult {
  const uid = useSession((state) => state.user?.uid ?? null);
  const [result, setResult] = useState<PatientsResult>({
    patients: [],
    loading: true,
    fromCache: true,
    error: null,
  });

  useEffect(() => {
    if (!uid) {
      setResult({ patients: [], loading: false, fromCache: true, error: null });
      return;
    }

    setResult((current) => ({ ...current, loading: true }));

    return subscribePatients(
      uid,
      status,
      (snapshot) =>
        setResult({
          patients: snapshot.patients,
          loading: false,
          fromCache: snapshot.fromCache,
          error: null,
        }),
      (error) => {
        // A missing composite index shows up here and nowhere else. Never
        // swallow it: the board would just look permanently empty.
        console.error('[board] patient query failed', error);
        setResult({
          patients: [],
          loading: false,
          fromCache: true,
          error: 'Gagal memuat daftar pasien.',
        });
      },
    );
  }, [uid, status]);

  return result;
}
