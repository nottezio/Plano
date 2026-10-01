import { useEffect, useState } from 'react';

import { findCachedPatient } from '@/data/patientsFeed';
import { subscribePatient } from '@/data/repositories/patients.repo';
import type { Patient } from '@/domain/types';
import { useSession } from '@/store/useSession';

export interface PatientResult {
  patient: Patient | null;
  loading: boolean;
  error: string | null;
}

export function usePatient(patientId: string | undefined): PatientResult {
  const uid = useSession((state) => state.user?.uid ?? null);
  /*
    First paint from the board's live list when the patient is on it, so
    opening a card shows the chart at once instead of "Memuat…" while the
    single-document listener starts (2026-10-02). The listener below then
    replaces it with the document itself.
  */
  const [result, setResult] = useState<PatientResult>(() => {
    const cached = patientId ? findCachedPatient(uid, patientId) : null;
    return cached
      ? { patient: cached, loading: false, error: null }
      : { patient: null, loading: true, error: null };
  });

  useEffect(() => {
    if (!patientId) {
      setResult({ patient: null, loading: false, error: null });
      return;
    }
    // Navigating to another patient: show that one from the list at once.
    const cached = findCachedPatient(uid, patientId);
    setResult((current) =>
      current.patient?.id === patientId
        ? current
        : cached
          ? { patient: cached, loading: false, error: null }
          : { patient: null, loading: true, error: null },
    );
    return subscribePatient(
      patientId,
      (patient) => setResult({ patient, loading: false, error: null }),
      (error) => {
        console.error('[patient] subscription failed', error);
        // Keep whatever we already have. A dropped listener is not a reason to
        // blank a note the user may be mid-sentence in, and the cached copy is
        // still the truth as far as this device is concerned.
        setResult((current) =>
          current.patient
            ? { ...current, loading: false }
            : { patient: null, loading: false, error: 'Gagal memuat pasien.' },
        );
      },
    );
  }, [patientId, uid]);

  return result;
}
