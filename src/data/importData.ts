import { Timestamp, getDoc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore';
import { nanoid } from 'nanoid';

import { db } from './firebase';
import { checklistDoc, documentDoc, documentsCol, entryDoc, patientDoc, patientsCol, userDoc } from './paths';
import { trackWrite } from './syncStatus';
import { mergeProfile, planImport, type ImportPlan } from '@/domain/importBundle';

/**
 * Timestamps come back from JSON as `{seconds, nanoseconds}` (plus `type` on
 * newer SDKs). Written as plain objects they would stop being dates: every
 * `.toMillis()` in the app would throw on them. Revived here, recursively.
 */
export function reviveTimestamps(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reviveTimestamps);
  if (!value || typeof value !== 'object') return value;
  const object = value as Record<string, unknown>;
  const keys = Object.keys(object);
  if (
    typeof object['seconds'] === 'number' &&
    typeof object['nanoseconds'] === 'number' &&
    keys.every((key) => key === 'seconds' || key === 'nanoseconds' || key === 'type')
  ) {
    return new Timestamp(object['seconds'], object['nanoseconds']);
  }
  const out: Record<string, unknown> = {};
  for (const key of keys) out[key] = reviveTimestamps(object[key]);
  return out;
}

/** Everything the import needs to know about this account, read once. */
export async function prepareImport(uid: string, bundle: Record<string, unknown>): Promise<ImportPlan> {
  const [patientSnap, documentSnap] = await Promise.all([
    getDocs(query(patientsCol(), where('memberIds', 'array-contains', uid))),
    getDocs(documentsCol(uid)),
  ]);
  const existing = patientSnap.docs.map((snapshot) => {
    const data = snapshot.data() as { importedFrom?: string };
    return { id: snapshot.id, importedFrom: data.importedFrom };
  });
  const documentIds = new Set(documentSnap.docs.map((snapshot) => snapshot.id));
  return planImport(reviveTimestamps(bundle) as Record<string, unknown>, existing, documentIds, uid, () => nanoid(12));
}

export interface ImportProgress {
  done: number;
  total: number;
}

/**
 * Write the plan. Needs a connection: each patient document must exist on
 * the SERVER before its notes can be written (the rules check membership on
 * the parent), and a queued offline write never confirms that.
 *
 * Patient by patient, so a failure part-way leaves whole patients, never a
 * patient without notes, and a second run picks up where this stopped
 * (`importedFrom` makes it skip what is already in).
 */
export async function runImport(
  uid: string,
  plan: ImportPlan,
  options: { profile: boolean; replaceSettings: boolean },
  onProgress: (progress: ImportProgress) => void,
): Promise<{ failed: string[] }> {
  const failed: string[] = [];
  const total = plan.patients.length + (plan.documents.length > 0 ? 1 : 0) + (options.profile ? 1 : 0);
  let done = 0;

  for (const patient of plan.patients) {
    try {
      await trackWrite(setDoc(patientDoc(patient.newId), patient.record));
      const writes = [
        ...patient.entries.map((entry) => ({ ref: entryDoc(patient.newId, entry.date), data: entry.data })),
        ...patient.checklists.map((checklist) => ({
          ref: checklistDoc(patient.newId, checklist.date),
          data: checklist.data,
        })),
      ];
      // Batches of 400: under Firestore's 500-write limit.
      for (let start = 0; start < writes.length; start += 400) {
        const batch = writeBatch(db());
        for (const write of writes.slice(start, start + 400)) batch.set(write.ref, write.data);
        await trackWrite(batch.commit());
      }
    } catch (error) {
      console.error('[import] patient failed', patient.sourceId, error);
      failed.push(patient.name);
    }
    done += 1;
    onProgress({ done, total });
  }

  if (plan.documents.length > 0) {
    try {
      for (let start = 0; start < plan.documents.length; start += 400) {
        const batch = writeBatch(db());
        for (const document of plan.documents.slice(start, start + 400)) {
          batch.set(documentDoc(uid, document['id'] as string), document);
        }
        await trackWrite(batch.commit());
      }
    } catch (error) {
      console.error('[import] documents failed', error);
      failed.push('Dokumen');
    }
    done += 1;
    onProgress({ done, total });
  }

  if (options.profile && Object.keys(plan.profile).length > 0) {
    try {
      const current = (await getDoc(userDoc(uid))).data() ?? {};
      const patch = mergeProfile(current, plan.profile, options.replaceSettings);
      if (Object.keys(patch).length > 0) await trackWrite(setDoc(userDoc(uid), patch, { merge: true }));
    } catch (error) {
      console.error('[import] profile failed', error);
      failed.push('Pengaturan & catatan pribadi');
    }
    done += 1;
    onProgress({ done, total });
  }

  return { failed };
}
