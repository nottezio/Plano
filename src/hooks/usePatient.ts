import { useEffect, useState } from 'react';

import { subscribePatient } from '@/data/repositories/patients.repo';
import type { Patient } from '@/domain/types';

export interface PatientResult {
  patient: Patient | null;
  loading: boolean;
  error: string | null;
}

export function usePatient(patientId: string | undefined): PatientResult {
  const [result, setResult] = useState<PatientResult>({
    patient: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!patientId) {
      setResult({ patient: null, loading: false, error: null });
      return;
    }
    return subscribePatient(
      patientId,
      (patient) => setResult({ patient, loading: false, error: null }),
      (error) => {
        console.error('[patient] subscription failed', error);
        setResult({ patient: null, loading: false, error: 'Gagal memuat pasien.' });
      },
    );
  }, [patientId]);

  return result;
}
