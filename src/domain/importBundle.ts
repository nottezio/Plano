/**
 * Importing a Plano export ("Unduh JSON") into the account signed in now.
 *
 * For moving to a new Google account, recovering after losing one, or
 * restoring on a fresh start. Pure: this decides WHAT to write; the data
 * layer (`data/importData.ts`) writes it.
 *
 * THE RULES IT FOLLOWS
 *
 * - **Nothing already here is overwritten.** Import only adds. A patient,
 *   document or note that exists in this account is skipped and counted.
 * - **Patients get NEW ids.** Patient documents are top-level and the old
 *   account's patients still exist under their ids, owned by the old account;
 *   the rules (rightly) refuse to write into them. Each imported patient is a
 *   new document owned by this account, carrying `importedFrom` = its old id.
 * - **Idempotent.** A patient whose old id is already an `importedFrom` here
 *   (or its own id, when restoring into the same account) is skipped, so
 *   importing the same file twice creates no duplicates.
 * - **Per-request fields are dropped:** `baseHash` (a compare-and-set token
 *   for ONE write) and `editing` (presence). Ownership is replaced.
 */
import { SCHEMA_VERSION } from './types';

type Json = Record<string, unknown>;

export interface ImportPatient {
  sourceId: string;
  newId: string;
  name: string;
  record: Json;
  entries: Array<{ date: string; data: Json }>;
  checklists: Array<{ date: string; data: Json }>;
}

export interface ImportPlan {
  patients: ImportPatient[];
  skippedPatients: string[];
  documents: Json[];
  skippedDocuments: number;
  /** Profile fields offered for restore; empty when the file carries none. */
  profile: Json;
  counts: { patients: number; entries: number; checklists: number; documents: number };
  exportedAt: string;
  appVersion: string;
}

export type ParseResult = { ok: true; bundle: Json } | { ok: false; error: string };

/** Read and check the file. Messages are for the person holding it. */
export function parseBundle(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Berkas ini bukan JSON. Pilih berkas hasil "Unduh JSON" dari Plano.' };
  }
  if (!data || typeof data !== 'object' || !Array.isArray((data as Json)['patients'])) {
    return { ok: false, error: 'Berkas ini bukan ekspor Plano (tidak ada daftar pasien).' };
  }
  const bundle = data as Json;
  const schema = Number(bundle['schemaVersion'] ?? 1);
  if (schema > SCHEMA_VERSION) {
    return {
      ok: false,
      error: 'Berkas ini dari versi Plano yang lebih baru. Perbarui aplikasi dulu, lalu impor lagi.',
    };
  }
  return { ok: true, bundle };
}

/** Profile fields that belong to the PERSON and can be carried over. */
const PROFILE_FIELDS = [
  'settings',
  'checklists',
  'checklistDone',
  'notesById',
  'boardNotes',
  'morningReport',
] as const;

const DROP_FROM_ENTRY = new Set(['baseHash', 'editing']);

function isObject(value: unknown): value is Json {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function planImport(
  bundle: Json,
  existing: ReadonlyArray<{ id: string; importedFrom?: string | undefined }>,
  existingDocumentIds: ReadonlySet<string>,
  uid: string,
  newId: () => string,
): ImportPlan {
  const known = new Set<string>();
  for (const patient of existing) {
    known.add(patient.id);
    if (patient.importedFrom) known.add(patient.importedFrom);
  }

  const patients: ImportPatient[] = [];
  const skippedPatients: string[] = [];
  let entryCount = 0;
  let checklistCount = 0;

  for (const raw of (bundle['patients'] as unknown[]) ?? []) {
    if (!isObject(raw) || typeof raw['id'] !== 'string') continue;
    const sourceId = raw['id'];
    const name = typeof raw['name'] === 'string' && raw['name'].trim() ? raw['name'].trim() : sourceId;
    const origin = typeof raw['importedFrom'] === 'string' ? raw['importedFrom'] : sourceId;
    if (known.has(sourceId) || known.has(origin)) {
      skippedPatients.push(name);
      continue;
    }
    known.add(sourceId);

    const id = newId();
    const { entries: rawEntries, checklists: rawChecklists, ...fields } = raw;
    const record: Json = {
      ...fields,
      id,
      ownerId: uid,
      memberIds: [uid],
      importedFrom: origin,
      deletedAt: null,
    };

    const entries = (Array.isArray(rawEntries) ? rawEntries : [])
      .filter(isObject)
      .filter((entry) => typeof entry['date'] === 'string')
      .map((entry) => {
        const data: Json = {};
        for (const [key, value] of Object.entries(entry)) {
          if (!DROP_FROM_ENTRY.has(key)) data[key] = value;
        }
        data['editing'] = null;
        return { date: entry['date'] as string, data };
      });
    const checklists = (Array.isArray(rawChecklists) ? rawChecklists : [])
      .filter(isObject)
      .filter((checklist) => typeof checklist['date'] === 'string')
      .map((checklist) => ({ date: checklist['date'] as string, data: { ...checklist } }));

    entryCount += entries.length;
    checklistCount += checklists.length;
    patients.push({ sourceId, newId: id, name, record, entries, checklists });
  }

  const allDocuments = Array.isArray(bundle['documents']) ? bundle['documents'].filter(isObject) : [];
  const documents = allDocuments.filter(
    (document) => typeof document['id'] === 'string' && !existingDocumentIds.has(document['id']),
  );

  const profile: Json = {};
  const rawProfile = bundle['profile'];
  if (isObject(rawProfile)) {
    for (const field of PROFILE_FIELDS) {
      if (rawProfile[field] !== undefined) profile[field] = rawProfile[field];
    }
  }

  return {
    patients,
    skippedPatients,
    documents,
    skippedDocuments: allDocuments.length - documents.length,
    profile,
    counts: {
      patients: patients.length,
      entries: entryCount,
      checklists: checklistCount,
      documents: documents.length,
    },
    exportedAt: typeof bundle['exportedAt'] === 'string' ? bundle['exportedAt'] : '',
    appVersion: typeof bundle['appVersion'] === 'string' ? bundle['appVersion'] : '',
  };
}

/**
 * Merge the carried-over profile into the current one WITHOUT overwriting.
 *
 * Maps (Catatan notes, board notes, checklist ticks) gain only the keys this
 * account does not have; lists of saved checklists gain only unknown ids.
 * Settings are taken whole only when the person chose to replace them.
 */
export function mergeProfile(
  current: Json,
  incoming: Json,
  replaceSettings: boolean,
): Json {
  const patch: Json = {};
  for (const field of ['notesById', 'boardNotes', 'checklistDone'] as const) {
    const from = incoming[field];
    if (!isObject(from)) continue;
    const here = isObject(current[field]) ? (current[field] as Json) : {};
    const added: Json = {};
    for (const [key, value] of Object.entries(from)) if (!(key in here)) added[key] = value;
    if (Object.keys(added).length > 0) patch[field] = { ...here, ...added };
  }
  if (Array.isArray(incoming['checklists'])) {
    const here = Array.isArray(current['checklists']) ? (current['checklists'] as Json[]) : [];
    const ids = new Set(here.map((list) => list['id']));
    const added = (incoming['checklists'] as unknown[]).filter(
      (list): list is Json => isObject(list) && !ids.has(list['id']),
    );
    if (added.length > 0) patch['checklists'] = [...here, ...added];
  }
  if (replaceSettings && isObject(incoming['settings'])) patch['settings'] = incoming['settings'];
  if (incoming['morningReport'] !== undefined && current['morningReport'] === undefined) {
    patch['morningReport'] = incoming['morningReport'];
  }
  return patch;
}
