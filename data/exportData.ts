import { getDocs, query, where } from 'firebase/firestore';

import { checklistDoc, documentsCol, entriesCol, patientsCol, userDoc } from './paths';
import { getDoc } from 'firebase/firestore';
import type {
  AppDocument,
  DailyChecklist,
  DailyEntry,
  Patient,
  UserProfile,
} from '@/domain/types';
import { SCHEMA_VERSION } from '@/domain/types';
import { APP_VERSION } from '@/version.js';

/**
 * SPEC F11 / 18 — export everything as JSON.
 *
 * This is the escape hatch: the user can leave, keep a personal backup, or hand
 * the record to someone else without asking anyone's permission. It reads
 * through `getDocs`, which serves from the persistent cache, so an export works
 * offline for anything already synced.
 *
 * The file contains full patient names and complete note bodies. The UI says so
 * before the download starts — an unlabelled JSON of clinical records sitting
 * in a Downloads folder is a privacy incident waiting to happen.
 */
export interface ExportBundle {
  exportedAt: string;
  appVersion: string;
  schemaVersion: number;
  profile: UserProfile | null;
  patients: Array<
    Patient & {
      entries: DailyEntry[];
      checklists: DailyChecklist[];
    }
  >;
  documents: AppDocument[];
}

export async function exportAll(uid: string): Promise<ExportBundle> {
  const profileSnap = await getDoc(userDoc(uid));
  const patientSnap = await getDocs(
    query(patientsCol(), where('memberIds', 'array-contains', uid)),
  );

  const patients: ExportBundle['patients'] = [];

  for (const doc of patientSnap.docs) {
    const patient = doc.data() as Patient;
    const entrySnap = await getDocs(entriesCol(patient.id));
    const entries = entrySnap.docs.map((entry) => entry.data() as DailyEntry);

    // Checklists are keyed by the same clinical dates as the entries, so there
    // is no separate listing to walk.
    const checklists: DailyChecklist[] = [];
    for (const entry of entries) {
      const checklistSnap = await getDoc(checklistDoc(patient.id, entry.date));
      if (checklistSnap.exists()) checklists.push(checklistSnap.data() as DailyChecklist);
    }

    patients.push({ ...patient, entries, checklists });
  }

  const documentSnap = await getDocs(documentsCol(uid));

  return {
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    profile: profileSnap.exists() ? (profileSnap.data() as UserProfile) : null,
    patients,
    documents: documentSnap.docs.map((doc) => doc.data() as AppDocument),
  };
}

export function downloadJson(bundle: ExportBundle): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `visite-export-${bundle.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
