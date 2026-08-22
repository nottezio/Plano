import { getDocs, query, where } from 'firebase/firestore';

import { checklistDoc, documentsCol, entriesCol, patientsCol, userDoc } from './paths';
import { getDoc, getDocFromCache, getDocsFromCache } from 'firebase/firestore';
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
  /** Patients whose notes could not be read. Empty on a clean export. */
  incomplete?: string[];
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

/**
 * Read from the server, falling back to the local cache.
 *
 * `getDoc` and `getDocs` go to the server and REJECT when it is unreachable,
 * which is why "Unduh JSON" reported "Ekspor gagal. Coba lagi saat daring." —
 * even though every document was sitting in the offline cache already.
 *
 * That failure is exactly backwards for this feature: an export is the thing
 * you want most when the connection is unreliable, because it is the only copy
 * of your data you control.
 */
async function readDoc(reference: Parameters<typeof getDoc>[0]) {
  try {
    return await getDoc(reference);
  } catch {
    return await getDocFromCache(reference);
  }
}

async function readDocs(reference: Parameters<typeof getDocs>[0]) {
  try {
    return await getDocs(reference);
  } catch {
    return await getDocsFromCache(reference);
  }
}

export async function exportAll(uid: string): Promise<ExportBundle> {
  const profileSnap = await readDoc(userDoc(uid));
  const patientSnap = await readDocs(
    query(patientsCol(), where('memberIds', 'array-contains', uid)),
  );

  const patients: ExportBundle['patients'] = [];

  /**
   * One failure must not lose the whole export.
   *
   * It walks every patient, every entry and every checklist in sequence, so a
   * single rejection anywhere — a rules denial on one subcollection, a document
   * missing from the cache — rejected the entire promise and reported "coba
   * lagi saat daring", which was wrong twice over: the connection was fine, and
   * everything else had read successfully.
   *
   * An export that is missing one patient and says so is worth far more than no
   * export at all.
   */
  const failures: string[] = [];

  for (const doc of patientSnap.docs) {
    const patient = doc.data() as Patient;

    try {
      const entrySnap = await readDocs(entriesCol(patient.id));
      const entries = entrySnap.docs.map((entry) => entry.data() as DailyEntry);

      // Checklists are keyed by the same clinical dates as the entries, so
      // there is no separate listing to walk.
      const checklists: DailyChecklist[] = [];
      for (const entry of entries) {
        try {
          const checklistSnap = await readDoc(checklistDoc(patient.id, entry.date));
          if (checklistSnap.exists()) checklists.push(checklistSnap.data() as DailyChecklist);
        } catch {
          // A missing checklist is not a reason to lose the note it belongs to.
        }
      }

      patients.push({ ...patient, entries, checklists });
    } catch (error) {
      console.error('[export] skipped patient', patient.id, error);
      failures.push(patient.name?.trim() || patient.id);
      // The patient record itself still goes in; only their notes are missing.
      patients.push({ ...patient, entries: [], checklists: [] });
    }
  }

  const documentSnap = await readDocs(documentsCol(uid));

  return {
    ...(failures.length > 0 ? { incomplete: failures } : {}),
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
  link.download = `plano-export-${bundle.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
