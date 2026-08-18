import {
  arrayUnion,
  deleteField,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { nanoid } from 'nanoid';

import { getDeviceId } from '../deviceId';
import { clinicalStart } from '@/domain/identity';
import { primaryDpjp } from '@/domain/dpjp';
import { parsePatientFacts } from '@/domain/parsePatient';
import { parseSections } from '@/domain/sections/parseSections';
import { DEFAULT_SECTION_ALIASES } from '@/domain/sections/aliases';
import type { SectionAlias } from '@/domain/types';
import { patientDoc, patientsCol } from '../paths';
import { trackWrite } from '../syncStatus';
import type {
  ArchiveReason,
  ClinicalDate,
  Patient,
  PatientStatus,
  Sex,
} from '@/domain/types';

/**
 * SPEC 5 — "UI never imports firebase/firestore directly."
 * Everything crosses this boundary.
 */

export interface CreatePatientInput {
  /**
   * Optional. A patient created from the board's + button has no name yet —
   * the board titles them from the first line of their note until someone
   * fills this in. Requiring it here would put a form between the user and a
   * blank page, which is the one thing this app must never do (SPEC 1.2).
   */
  name?: string;
  admittedAt: ClinicalDate;
  mrn?: string;
  age?: number;
  sex?: Sex;
  ward?: string;
  room?: string;
  bed?: string;
  dpjp?: string;
  diagnoses?: string[];
  labels?: string[];
}

/** F10 — lowercase haystack for instant offline search. */
export function buildSearchBlob(
  patient: Pick<Patient, 'name' | 'diagnoses'> &
    Partial<Pick<Patient, 'mrn' | 'bed' | 'ward' | 'dpjp'>>,
): string {
  return [patient.name, patient.mrn, patient.bed, patient.ward, patient.dpjp, ...patient.diagnoses]
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase();
}

/**
 * Client-generated nanoid (SPEC 6.3): the document id exists before the write
 * leaves the device, so creating a patient in airplane mode is instant, has a
 * stable route, and cannot produce a duplicate on reconnect.
 */
export function createPatient(uid: string, input: CreatePatientInput): {
  id: string;
  written: Promise<void>;
} {
  const id = nanoid(12);
  const diagnoses = input.diagnoses ?? [];
  const labels = input.labels ?? [];

  const record: DocumentData = {
    id,
    ownerId: uid,
    memberIds: [uid],
    name: input.name?.trim() ?? '',
    notes: '',
    diagnoses,
    labels,
    admittedAt: input.admittedAt,
    status: 'active' satisfies PatientStatus,
    pinned: false,
    colorOverride: null,
    searchBlob: buildSearchBlob({ ...input, name: input.name?.trim() ?? '', diagnoses }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: getDeviceId(),
    deletedAt: null,
  };

  // Firestore rejects `undefined`; omit rather than write nulls that would
  // then have to be distinguished from "explicitly cleared" later.
  for (const key of ['mrn', 'age', 'sex', 'ward', 'bed', 'dpjp'] as const) {
    const value = input[key];
    if (value !== undefined && value !== '') record[key] = value;
  }

  return { id, written: trackWrite(setDoc(patientDoc(id), record)) };
}

/** Longest preview the board can show: 4 lines at a comfortable card width. */
const PREVIEW_LIMIT = 240;

export function buildPreview(body: string, aliases?: readonly SectionAlias[]): string {
  const resolved = aliases ?? DEFAULT_SECTION_ALIASES;
  const sections = parseSections(body, resolved);
  const trimmed = body.slice(clinicalStart(sections)).trim();

  return trimmed.length > PREVIEW_LIMIT ? `${trimmed.slice(0, PREVIEW_LIMIT)}…` : trimmed;
}

/**
 * Refreshes the board caches after a body write. Called from entries.repo so
 * no call site can forget it and leave the board showing yesterday's text.
 */
/**
 * Facts the note can tell us about the patient.
 *
 * ABSENCE IS NOT A CORRECTION. An earlier version cleared `dpjpId` whenever the
 * body being written named nobody — which meant opening a fresh day and typing
 * one character wiped the consultant, because a blank new day names nobody.
 * The patient's DPJP is a fact about the patient, not about today's page.
 *
 * So a derived field is only ever WRITTEN when the note actually contains it.
 * Clearing happens when the user clears the field in the identity form, which
 * is the one place they can say they meant it.
 *
 * Identity fields go further and fill only what is BLANK: someone who typed a
 * name into the form outranks a line in a note, and silently overwriting a
 * corrected MRN with the uncorrected one from the note text would be the worst
 * possible reading of "keep them in sync".
 */
function derivedPatientFields(body: string): DocumentData {
  const fields: DocumentData = {};

  const dpjp = primaryDpjp(body);
  if (dpjp) fields['dpjpId'] = dpjp.id;

  return fields;
}

/**
 * Fills blank patient fields from the note. Never overwrites a typed value.
 *
 * Separate from `touchEntryMeta` because it needs the CURRENT patient to know
 * what is blank, and because it should run on a real edit rather than on every
 * autosave flush.
 */
export function fillPatientFromNote(patient: Patient, body: string): Promise<void> | null {
  const facts = parsePatientFacts(body);
  const patch: PatientPatch = {};

  if (!patient.name?.trim() && facts.name) patch.name = facts.name;
  if (!patient.mrn?.trim() && facts.mrn) patch.mrn = facts.mrn;
  if (patient.age === undefined && facts.age !== undefined) patch.age = facts.age;
  if (!patient.ward?.trim() && facts.ward) patch.ward = facts.ward;
  if (!patient.room?.trim() && facts.room) patch.room = facts.room;
  if (!patient.bed?.trim() && facts.bed) patch.bed = facts.bed;

  if (Object.keys(patch).length === 0) return null;

  // The search blob is rebuilt from the merged result, so a name learned from
  // the note becomes searchable in the same write that stores it.
  // The search blob is rebuilt from the merged result, so a name learned from
  // the note becomes searchable in the same write that stores it. Optional keys
  // are only included when set — `exactOptionalPropertyTypes` treats "absent"
  // and "present but undefined" as different, and so does Firestore.
  const blobSource: Parameters<typeof buildSearchBlob>[0] = {
    name: patch.name ?? patient.name ?? '',
    diagnoses: patient.diagnoses,
  };
  const mrn = patch.mrn ?? patient.mrn;
  const ward = patch.ward ?? patient.ward;
  const bed = patch.bed ?? patient.bed;
  if (mrn) blobSource.mrn = mrn;
  if (ward) blobSource.ward = ward;
  if (bed) blobSource.bed = bed;
  if (patient.dpjp) blobSource.dpjp = patient.dpjp;

  return updatePatient(patient.id, patch, blobSource);
}

export function touchEntryMeta(
  patientId: string,
  date: ClinicalDate,
  body: string,
): Promise<void> {
  return trackWrite(
    updateDoc(patientDoc(patientId), {
      lastEntryDate: date,
      preview: buildPreview(body),
      previewDate: date,
      ...derivedPatientFields(body),
      updatedAt: serverTimestamp(),
      updatedBy: getDeviceId(),
    }),
  );
}

/**
 * Rewrites the whole cache object rather than merging a single key: a merge
 * would leave yesterday's ticks sitting under today's date the first time an
 * item is ticked after midnight.
 */
export function cacheBoardChecklist(
  patientId: string,
  date: ClinicalDate,
  done: Record<string, boolean>,
): Promise<void> {
  return trackWrite(
    updateDoc(patientDoc(patientId), {
      boardChecklist: { date, done },
      updatedAt: serverTimestamp(),
      updatedBy: getDeviceId(),
    }),
  );
}

/**
 * `undefined` is meaningful here, not merely absent: `updatePatient` reads it
 * as "clear this field" and writes `deleteField()`. Under
 * `exactOptionalPropertyTypes` that has to be spelled out, or callers cannot
 * express a clear at all.
 */
export type PatientPatch = {
  [K in PatientPatchKey]?: Patient[K] | undefined;
};

type PatientPatchKey = keyof Pick<
  Patient,
  | 'name'
  | 'mrn'
  | 'age'
  | 'sex'
  | 'ward'
  | 'room'
  | 'bed'
  | 'dpjp'
  | 'dpjpId'
  | 'notes'
  | 'diagnoses'
  | 'labels'
  | 'pinned'
  | 'discharge'
  | 'colorOverride'
  | 'admittedAt'
  | 'lastEntryDate'
>;

export function updatePatient(
  patientId: string,
  patch: PatientPatch,
  searchBlobSource?: Parameters<typeof buildSearchBlob>[0],
): Promise<void> {
  const payload: DocumentData = {
    ...patch,
    updatedAt: serverTimestamp(),
    updatedBy: getDeviceId(),
  };
  if (searchBlobSource) payload['searchBlob'] = buildSearchBlob(searchBlobSource);

  // An explicit `undefined` in a patch means "clear this field".
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) payload[key] = deleteField();
  }

  return trackWrite(updateDoc(patientDoc(patientId), payload));
}

export function archivePatient(
  patientId: string,
  reason: ArchiveReason,
  note?: string,
): Promise<void> {
  const archive: DocumentData = { reason, at: serverTimestamp() };
  if (note && note.trim()) archive['note'] = note.trim();

  return trackWrite(
    updateDoc(patientDoc(patientId), {
      status: 'archived' satisfies PatientStatus,
      archive,
      updatedAt: serverTimestamp(),
      updatedBy: getDeviceId(),
    }),
  );
}

export function reopenPatient(patientId: string): Promise<void> {
  return trackWrite(
    updateDoc(patientDoc(patientId), {
      status: 'active' satisfies PatientStatus,
      archive: deleteField(),
      updatedAt: serverTimestamp(),
      updatedBy: getDeviceId(),
    }),
  );
}

/**
 * Soft delete.
 *
 * Sets `deletedAt`, which every query already filters on, so the patient
 * disappears from the board and the archive at once. The document itself
 * stays: `firestore.rules` still denies hard `delete`, so a mistake here is
 * recoverable by an admin rather than final. Restoring is a one-field write.
 */
export function deletePatient(patientId: string): Promise<void> {
  return trackWrite(
    updateDoc(patientDoc(patientId), {
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: getDeviceId(),
    }),
  );
}

/**
 * SPEC 1.2 rule 5 — the blank page.
 *
 * Tapping + on the board creates the record immediately and navigates. No
 * sheet, no required fields, nothing between the tap and a cursor in an empty
 * note. Identity can be filled in later, or never: the board derives a title
 * from the note itself.
 *
 * `admittedAt` defaults to today because hari rawat has to count from
 * something; it is editable afterwards like every other field.
 */
export function createBlankPatient(
  uid: string,
  today: ClinicalDate,
): { id: string; written: Promise<void> } {
  return createPatient(uid, { admittedAt: today });
}

/**
 * There is NO delete in this repository — not even a soft one.
 *
 * Removing a patient from the board is archiving, and archiving keeps every
 * entry, checklist day and revision. A delete path would exist only to satisfy
 * a tidiness instinct, and the cost of a mis-tap is a ward round's worth of
 * notes. `deletedAt` survives in the schema because every query filters on it
 * and the security rules already deny `delete` outright.
 */

/** v1 no-op seam: sharing is a config change, not a migration (SPEC 6.1). */
export function addMember(patientId: string, uid: string): Promise<void> {
  return trackWrite(
    updateDoc(patientDoc(patientId), {
      memberIds: arrayUnion(uid),
      updatedAt: serverTimestamp(),
      updatedBy: getDeviceId(),
    }),
  );
}

export function subscribePatient(
  patientId: string,
  callback: (patient: Patient | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    patientDoc(patientId),
    (snapshot) => callback(snapshot.exists() ? (snapshot.data() as Patient) : null),
    onError,
  );
}

export interface PatientsSnapshot {
  patients: Patient[];
  /** True while the payload is served from cache with writes still queued. */
  fromCache: boolean;
  hasPendingWrites: boolean;
}

function mapSnapshot(snapshot: QuerySnapshot): PatientsSnapshot {
  return {
    patients: snapshot.docs.map((entry) => entry.data() as Patient),
    fromCache: snapshot.metadata.fromCache,
    hasPendingWrites: snapshot.metadata.hasPendingWrites,
  };
}

/**
 * Board query (SPEC 8): memberIds array-contains uid, status, deletedAt,
 * ordered pinned desc then updatedAt desc. Mirrored in firestore.indexes.json.
 */
export function subscribePatients(
  uid: string,
  status: PatientStatus,
  callback: (snapshot: PatientsSnapshot) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const q = query(
    patientsCol(),
    where('memberIds', 'array-contains', uid),
    where('status', '==', status),
    where('deletedAt', '==', null),
    // Newest note first, like a notes app. The previous pinned+updatedAt
    // ordering reshuffled the board every time anyone typed a character,
    // so a card was never twice in the same place — unusable on a round.
    orderBy('createdAt', 'desc'),
  );

  return onSnapshot(
    q,
    // Cache-first so the board paints with no signal, then re-renders on sync.
    { includeMetadataChanges: true },
    (snapshot) => callback(mapSnapshot(snapshot)),
    onError,
  );
}

