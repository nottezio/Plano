import {
  addDoc,
  doc,
  arrayRemove,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  getCountFromServer,
  deleteDoc,
  writeBatch,
  limit,
  orderBy,
  startAfter,
  arrayUnion,
  deleteField,
  FieldPath,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import {
  floorDaysCol,
  floorDoc,
  floorEditionDoc,
  floorEditionsCol,
  floorPatientDoc,
  floorPatientsCol,
  floorRestorePartDoc,
  floorRestorePartsCol,
  floorRestoresCol,
  floorsCol,
  floorVisitNoteDoc,
} from '../paths';
import { trackWrite } from '../syncStatus';
import { legacyColourDate, type Edition, type FloorDoc, type FloorRole, type RosterPatient, type StatusChange } from '@/domain/floorList/floor';
import { readSectionTitles, type SectionTitles } from '@/domain/floorList/analysis';
import { isMarkColor, MARK_PREFIX, readMarks, type FloorMark, type PatientTag } from '@/domain/floorList/marks';
import { manualFullText, type FloorPatient } from '@/domain/floorList/report';
import { fromParts, KEEP_POINTS, restored, toParts, type RestorePlan, type RestorePoint, type RestorePointMeta } from '@/domain/floorList/restore';

/**
 * Firestore access for List Maker floors (12.8). See `domain/floorList/floor.ts`
 * for the shape and `firestore.rules` (`match /floors/…`) for who may do what.
 *
 * Every write is a LEAF: one patient, one edit, one member — never the whole
 * map read back and rewritten (pattern 5). Emails are map KEYS here, and an
 * email has dots, so those leaves are written with `FieldPath`, never a dotted
 * string.
 */

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function record<T>(value: unknown, pick: (v: unknown) => T | null): Record<string, T> {
  const out: Record<string, T> = {};
  if (value && typeof value === 'object') {
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      const v = pick(raw);
      if (v !== null) out[key] = v;
    }
  }
  return out;
}

const role = (v: unknown): FloorRole | null => (v === 'edit' || v === 'view' ? v : null);
const text = (v: unknown): string | null => (typeof v === 'string' ? v : null);

export function readFloor(id: string, data: DocumentData): FloorDoc {
  return {
    id,
    name: str(data.name) || 'Lantai',
    ward: str(data.ward),
    ownerUid: str(data.ownerUid),
    memberIds: Array.isArray(data.memberIds) ? data.memberIds.filter((v: unknown): v is string => typeof v === 'string') : [],
    roles: record(data.roles, role),
    names: record(data.names, text),
    invites: record(data.invites, role),
    inviteEmails: Array.isArray(data.inviteEmails) ? data.inviteEmails.filter((v: unknown): v is string => typeof v === 'string') : [],
    nicknames: record(data.nicknames, text),
    chiefs: str(data.chiefs),
    chiefBangsal: str(data.chiefBangsal),
    juniors: str(data.juniors),
    marks: readMarks(data.marks),
    analysisTitles: readSectionTitles(data.analysisTitles),
  };
}

export function readPatient(raw: unknown): FloorPatient | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.key !== 'string' || typeof p.full !== 'string') return null;
  const discharge = p.discharge === 'today' || p.discharge === 'tomorrow' ? p.discharge : null;
  const patient: FloorPatient = {
    key: p.key,
    rm: str(p.rm),
    name: str(p.name),
    identity: str(p.identity),
    room: str(p.room),
    bed: str(p.bed),
    floor: str(p.floor),
    dpjpId: typeof p.dpjpId === 'string' ? p.dpjpId : null,
    kjsDpjpIds: Array.isArray(p.kjsDpjpIds) ? p.kjsDpjpIds.filter((v): v is string => typeof v === 'string') : [],
    btkv: p.btkv === true,
    body: str(p.body),
    full: p.full,
    chief: str(p.chief),
    junior: str(p.junior),
    senderNick: str(p.senderNick),
    sender: str(p.sender),
    sentAt: str(p.sentAt),
    index: typeof p.index === 'number' ? p.index : 0,
    discharge,
    ...(p.manual === true ? { manual: true } : {}),
    ...(p.edited === true ? { edited: true } : {}),
    ...(typeof p.editedAt === 'string' && p.editedAt ? { editedAt: p.editedAt } : {}),
    ...(p.fromList === true ? { fromList: true } : {}),
    ...readTags(p.tags, p.mark),
    ...(typeof p.dpjpCode === 'string' && p.dpjpCode ? { dpjpCode: p.dpjpCode } : {}),
    ...(typeof p.operkan === 'string' && p.operkan ? { operkan: p.operkan } : {}),
    ...(typeof p.gantiChief === 'string' && p.gantiChief ? { gantiChief: p.gantiChief } : {}),
    ...(p.usul === true ? { usul: true } : {}),
    ...(p.manualFields && typeof p.manualFields === 'object'
      ? {
          manualFields: {
            diagnosis: str((p.manualFields as Record<string, unknown>).diagnosis),
            terapi: str((p.manualFields as Record<string, unknown>).terapi),
            plan: str((p.manualFields as Record<string, unknown>).plan),
          },
        }
      : {}),
    ...(typeof p.division === 'string' && p.division ? { division: p.division } : {}),
  };
  // A hand entry stored before 13.12 has its own text shape: shown as a ward report.
  if (patient.manual && patient.manualFields && !/\batas\s+nama\b/i.test(patient.full)) {
    patient.full = manualFullText({ ...patient, fields: patient.manualFields });
  }
  return patient;
}

/** Tags of a stored (edition) patient; 13.7 stored one as `mark`. */
function readTags(raw: unknown, legacy: unknown): { tags?: PatientTag[] } {
  const list = (Array.isArray(raw) ? raw : legacy ? [legacy] : []).filter(
    (t): t is { label: string; color: PatientTag['color'] } =>
      !!t && typeof t === 'object' && typeof (t as Record<string, unknown>).label === 'string' && isMarkColor((t as Record<string, unknown>).color),
  );
  return list.length > 0 ? { tags: list.map((t) => ({ label: t.label, color: t.color })) } : {};
}

function readLog(raw: unknown): StatusChange[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map((e) => ({ at: str(e.at), by: str(e.by), what: str(e.what) }));
}

export function readRosterPatient(key: string, data: DocumentData): RosterPatient | null {
  const report = readPatient(data.report);
  if (!report) return null;
  const status = data.status === 'pulang' || data.status === 'pindah' ? data.status : 'dirawat';
  const colour: RosterPatient['colour'] = data.colour === 'h1' || data.colour === 'today' ? data.colour : 'none';
  const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0) : []);
  // 13.7 stored a hand mark as colour "m:<id>": read as a tag (13.10).
  const legacy = typeof data.colour === 'string' && data.colour.startsWith(MARK_PREFIX) ? [data.colour.slice(MARK_PREFIX.length)] : [];
  const log = readLog(data.log);
  // A hand mark stored as a stage (before 13.16) becomes the date it meant, so it ages (`colourFields`).
  const carried = str(data.dischargeDate) ? '' : legacyColourDate(colour, log);
  return {
    key,
    report: { ...report, key },
    status,
    pindahKe: str(data.pindahKe),
    leftAt: str(data.leftAt),
    colour: carried ? 'none' : colour,
    dischargeDate: str(data.dischargeDate) || carried,
    usulH1: str(data.usulH1),
    junior: str(data.junior),
    chief: str(data.chief),
    dismissed: str(data.dismissed),
    placedAt: str(data.placedAt),
    division: str(data.division),
    tags: [...new Set([...ids(data.tags), ...legacy])],
    tagsOff: ids(data.tagsOff),
    operkan: str(data.operkan),
    gantiChief: str(data.gantiChief),
    chiefDismissed: str(data.chiefDismissed),
    addedAt: str(data.addedAt),
    log,
  };
}

export function readEdition(id: string, data: DocumentData): Edition {
  return {
    id,
    date: str(data.date),
    time: str(data.time),
    text: str(data.text),
    patients: Array.isArray(data.patients) ? data.patients.map(readPatient).filter((p): p is FloorPatient => p !== null) : [],
    createdAt: str(data.createdAt),
    createdBy: str(data.createdBy),
  };
}

/** Pre-12.12 storage, read once to move it onto the roster. */
export async function readLegacy(floorId: string): Promise<{ reports: FloorPatient[]; manual: FloorPatient[] }> {
  const [days, floor] = await Promise.all([getDocs(floorDaysCol(floorId)), getDoc(floorDoc(floorId))]);
  const reports = days.docs.flatMap((d) => Object.values(record(d.data().patients, readPatient)));
  const manual = Object.values(record(floor.data()?.manual, readPatient));
  return { reports, manual };
}

/** Floors I belong to. */
export function subscribeMyFloors(uid: string, callback: (floors: FloorDoc[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(floorsCol(), where('memberIds', 'array-contains', uid)),
    (snapshot) => callback(snapshot.docs.map((d) => readFloor(d.id, d.data()))),
    onError,
  );
}

/** Floors that invited my email and are waiting for me to accept. */
export function subscribeInvites(email: string, callback: (floors: FloorDoc[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(floorsCol(), where('inviteEmails', 'array-contains', email.toLowerCase())),
    (snapshot) => callback(snapshot.docs.map((d) => readFloor(d.id, d.data()))),
    onError,
  );
}

/** How long a patient who left (Pulang/Pindah) stays in the live roster. Older ones: `readRosterPatients`. */
export const ROSTER_LEFT_DAYS = 30;

/**
 * The floor's roster: every patient on the floor, and those who left in the
 * last `ROSTER_LEFT_DAYS` days.
 *
 * It was the whole collection, every patient ever on the floor, and each List
 * Maker open after 30 min away re-read all of it (Firestore charges a listen
 * that has been gone that long as a new query). Two queries now, joined when
 * both have answered. `leftAt` is an ISO string, so it compares as text.
 */
export function subscribeRoster(floorId: string, callback: (roster: RosterPatient[]) => void, onError: (e: Error) => void): Unsubscribe {
  const read = (docs: readonly QueryDocumentSnapshot[]): RosterPatient[] =>
    docs.map((d) => readRosterPatient(d.id, d.data())).filter((p): p is RosterPatient => p !== null);
  let here: RosterPatient[] | null = null;
  let left: RosterPatient[] | null = null;
  const emit = (): void => {
    if (here && left) callback([...here, ...left]);
  };
  const since = new Date(Date.now() - ROSTER_LEFT_DAYS * 86_400_000).toISOString();
  const offHere = onSnapshot(
    query(floorPatientsCol(floorId), where('status', '==', 'dirawat')),
    (snapshot) => {
      here = read(snapshot.docs);
      emit();
    },
    onError,
  );
  const offLeft = onSnapshot(
    query(floorPatientsCol(floorId), where('leftAt', '>=', since)),
    (snapshot) => {
      // A patient back on the floor keeps a stale `leftAt` only until the write lands; `here` has them.
      left = read(snapshot.docs).filter((p) => p.status !== 'dirawat');
      emit();
    },
    onError,
  );
  return () => {
    offHere();
    offLeft();
  };
}

/**
 * Roster patients by key, read once: the ones the live roster no longer holds
 * (left more than `ROSTER_LEFT_DAYS` ago), so a paste finds a readmission
 * instead of adding it as new, which would overwrite the old document.
 */
export async function readRosterPatients(floorId: string, keys: readonly string[]): Promise<RosterPatient[]> {
  const snapshots = await Promise.all(keys.map((key) => getDoc(floorPatientDoc(floorId, key))));
  return snapshots.flatMap((s) => {
    const patient = s.exists() ? readRosterPatient(s.id, s.data()) : null;
    return patient ? [patient] : [];
  });
}

/** Whether the floor has any roster patient at all, gone long ago included: one read. */
export async function rosterHasAny(floorId: string): Promise<boolean> {
  return !(await getDocs(query(floorPatientsCol(floorId), limit(1)))).empty;
}

/** The latest sent editions (newest first). */
export function subscribeEditions(floorId: string, callback: (editions: Edition[]) => void, onError: (e: Error) => void, count = 60): Unsubscribe {
  return onSnapshot(
    query(floorEditionsCol(floorId), orderBy('createdAt', 'desc'), limit(count)),
    (snapshot) => callback(snapshot.docs.map((d) => readEdition(d.id, d.data()))),
    onError,
  );
}

/**
 * One page of editions older than `before` (a createdAt), read once. Old lists
 * do not change, so no listener is kept: nothing is re-read when it reconnects.
 */
export async function readOlderEditions(floorId: string, before: string, count: number): Promise<Edition[]> {
  const snapshot = await getDocs(query(floorEditionsCol(floorId), orderBy('createdAt', 'desc'), startAfter(before), limit(count)));
  return snapshot.docs.map((d) => readEdition(d.id, d.data()));
}

/** The list's Catatan Visite (24 Oct 2026); null until someone writes it. */
export function subscribeVisitNote(floorId: string, callback: (note: { body: string } | null) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    floorVisitNoteDoc(floorId),
    (snapshot) => callback(snapshot.exists() ? { body: str(snapshot.data().body) } : null),
    onError,
  );
}

/** Edit members only (the rules agree). The body is never logged. */
export function writeVisitNote(floorId: string, body: string, uid: string): Promise<void> {
  return trackWrite(setDoc(floorVisitNoteDoc(floorId), { body, updatedBy: uid, updatedAt: serverTimestamp() }, { merge: true }));
}

export async function createFloor(uid: string, myName: string, name: string, ward: string): Promise<string> {
  const ref = await trackWrite(
    addDoc(floorsCol(), {
      name,
      ward,
      ownerUid: uid,
      memberIds: [uid],
      roles: { [uid]: 'edit' },
      names: { [uid]: myName },
      invites: {},
      inviteEmails: [],
      nicknames: {},
      chiefs: '',
      juniors: '',
      marks: [],
      analysisTitles: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
  return ref.id;
}

/** Firestore refuses `undefined` anywhere in a document. */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** A new patient on the roster (whole document: it did not exist). */
export function addRosterPatient(floorId: string, patient: RosterPatient): Promise<void> {
  const { key, ...data } = patient;
  return trackWrite(setDoc(floorPatientDoc(floorId, key), { ...plain(data), updatedAt: serverTimestamp() }));
}

export type RosterChange =
  | { kind: 'add'; patient: RosterPatient }
  | { kind: 'report'; key: string; report: FloorPatient; log?: StatusChange | undefined }
  | {
      kind: 'fields';
      key: string;
      fields: Partial<Pick<RosterPatient, 'status' | 'pindahKe' | 'leftAt' | 'chief' | 'gantiChief' | 'chiefDismissed'>>;
      log?: StatusChange | undefined;
    };

/**
 * A whole paste (or the legacy move) as batched writes (12.12).
 *
 * WHY: the paste awaited one write at a time, and with the offline cache each
 * await is a server round trip (plus the rules' get() of the floor). A full
 * WhatsApp export is ~120 patients, so "Menyimpan…" sat there for the better
 * part of a minute while the denah behind it had long filled in from the local
 * cache — Avi saw "it only appears after switching tabs". One batch per 400
 * writes: a single round trip, and all-or-nothing, so a dropped connection
 * cannot leave half a paste behind.
 */
export async function writeRosterBatch(floorId: string, changes: readonly RosterChange[]): Promise<void> {
  for (let i = 0; i < changes.length; i += 400) {
    const batch = writeBatch(floorDoc(floorId).firestore);
    for (const change of changes.slice(i, i + 400)) {
      if (change.kind === 'add') {
        const { key, ...data } = change.patient;
        batch.set(floorPatientDoc(floorId, key), { ...plain(data), updatedAt: serverTimestamp() });
      } else {
        batch.update(floorPatientDoc(floorId, change.key), {
          ...(change.kind === 'report' ? { report: plain(change.report) } : plain(change.fields)),
          ...(change.log ? { log: arrayUnion(plain(change.log)) } : {}),
          updatedAt: serverTimestamp(),
        });
      }
    }
    await trackWrite(batch.commit());
  }
}

/** A newer SOAP for a patient: only the report changes, never the status. */
export function writeRosterReport(floorId: string, key: string, report: FloorPatient, log?: StatusChange): Promise<void> {
  return trackWrite(
    updateDoc(floorPatientDoc(floorId, key), {
      report: plain(report),
      ...(log ? { log: arrayUnion(plain(log)) } : {}),
      updatedAt: serverTimestamp(),
    }),
  );
}

/**
 * A decision by hand: status, colour, discharge date, residents, dismissal.
 * Fields merged one by one; `log` appended (arrayUnion — never rewritten).
 */
export function writeRosterFields(
  floorId: string,
  key: string,
  fields: Partial<Pick<RosterPatient, 'status' | 'pindahKe' | 'leftAt' | 'colour' | 'dischargeDate' | 'usulH1' | 'junior' | 'chief' | 'dismissed' | 'division' | 'tags' | 'tagsOff' | 'operkan' | 'gantiChief' | 'chiefDismissed'>>,
  log?: StatusChange,
): Promise<void> {
  return trackWrite(
    updateDoc(floorPatientDoc(floorId, key), {
      ...plain(fields),
      ...(log ? { log: arrayUnion(plain(log)) } : {}),
      updatedAt: serverTimestamp(),
    }),
  );
}

/**
 * Room/bed changed by hand (moved within the floor, 12.12). Leaf writes into
 * the report, so a concurrent status change is not overwritten.
 */
export function writeRosterPlace(floorId: string, key: string, room: string, bed: string, placedAt: string, log: StatusChange): Promise<void> {
  return trackWrite(
    updateDoc(
      floorPatientDoc(floorId, key),
      new FieldPath('report', 'room'),
      room,
      new FieldPath('report', 'bed'),
      bed,
      'placedAt',
      placedAt,
      'log',
      arrayUnion(plain(log)),
      'updatedAt',
      serverTimestamp(),
    ),
  );
}

/**
 * The owner deletes a list (12.12): every roster patient, edition and
 * pre-12.12 day first, then the floor document — in that order, because the
 * rules check ownership through the parent document. Read from the SERVER so
 * a partial offline cache cannot leave patient data behind; offline → throws.
 */
export async function deleteFloor(floorId: string): Promise<void> {
  const refs = [];
  for (const col of [floorPatientsCol(floorId), floorEditionsCol(floorId), floorDaysCol(floorId)]) {
    const snapshot = await getDocsFromServer(col);
    refs.push(...snapshot.docs.map((d) => d.ref));
  }
  // Restore points hold patient data too (2026-10-16): their parts, then them.
  const points = await getDocsFromServer(floorRestoresCol(floorId));
  for (const point of points.docs) {
    const parts = await getDocsFromServer(floorRestorePartsCol(floorId, point.id));
    refs.push(...parts.docs.map((d) => d.ref), point.ref);
  }
  const visitNote = await getDocFromServer(floorVisitNoteDoc(floorId));
  if (visitNote.exists()) refs.push(visitNote.ref);
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(floorDoc(floorId).firestore);
    for (const ref of refs.slice(i, i + 400)) batch.delete(ref);
    await trackWrite(batch.commit());
  }
  await trackWrite(deleteDoc(floorDoc(floorId)));
}

/** The id is returned at once (offline too), so the edition's restore point can name it. */
export function saveEdition(floorId: string, edition: Omit<Edition, 'id'>): string {
  const ref = doc(floorEditionsCol(floorId));
  void trackWrite(setDoc(ref, { ...plain(edition), savedAt: serverTimestamp() })).catch((e: unknown) => console.error('[floors] edition', e));
  return ref.id;
}

/** Delete a saved list (13.14: saved twice, or by mistake). The roster is not touched. */
export function deleteEdition(floorId: string, editionId: string): Promise<void> {
  return trackWrite(deleteDoc(floorEditionDoc(floorId, editionId)));
}

/** Erase one patient from the roster (12.12; Pulang keeps the record instead). */
export function deleteRosterPatient(floorId: string, key: string): Promise<void> {
  return trackWrite(deleteDoc(floorPatientDoc(floorId, key)));
}

export function writeJuniors(floorId: string, juniors: string): Promise<void> {
  return trackWrite(updateDoc(floorDoc(floorId), 'juniors', juniors, 'updatedAt', serverTimestamp()));
}

/** The floor's own colours (13.7): the whole list, small and edited in one place. */
export function writeMarks(floorId: string, marks: readonly FloorMark[]): Promise<void> {
  return trackWrite(updateDoc(floorDoc(floorId), 'marks', plain(marks), 'updatedAt', serverTimestamp()));
}

/** The names of the Analisis sections (26 Oct 2026): the whole small map; a default-named section is simply absent. */
export function writeAnalysisTitles(floorId: string, titles: SectionTitles): Promise<void> {
  return trackWrite(updateDoc(floorDoc(floorId), 'analysisTitles', plain(readSectionTitles(titles)), 'updatedAt', serverTimestamp()));
}

export function writeChiefs(floorId: string, chiefs: string): Promise<void> {
  return trackWrite(updateDoc(floorDoc(floorId), 'chiefs', chiefs, 'updatedAt', serverTimestamp()));
}

/** The jam-dinas chief (24 Oct 2026, `chiefHandover.ts`): one name, '' = none. */
export function writeChiefBangsal(floorId: string, name: string): Promise<void> {
  return trackWrite(updateDoc(floorDoc(floorId), 'chiefBangsal', name, 'updatedAt', serverTimestamp()));
}

export function writeNickname(floorId: string, sender: string, nickname: string): Promise<void> {
  return trackWrite(
    updateDoc(floorDoc(floorId), new FieldPath('nicknames', sender), nickname.trim() || deleteField(), 'updatedAt', serverTimestamp()),
  );
}

/** Owner: invite (or re-role an invite). */
export function inviteMember(floorId: string, email: string, role: FloorRole): Promise<void> {
  const key = email.trim().toLowerCase();
  return trackWrite(
    updateDoc(floorDoc(floorId), new FieldPath('invites', key), role, 'inviteEmails', arrayUnion(key), 'updatedAt', serverTimestamp()),
  );
}

export function cancelInvite(floorId: string, email: string): Promise<void> {
  return trackWrite(
    updateDoc(floorDoc(floorId), new FieldPath('invites', email), deleteField(), 'inviteEmails', arrayRemove(email), 'updatedAt', serverTimestamp()),
  );
}

/** Invitee: accept with the role the owner chose (the rules check it). */
export function acceptInvite(floor: FloorDoc, uid: string, email: string, myName: string): Promise<void> {
  const key = email.toLowerCase();
  const role = floor.invites[key] ?? 'view';
  return trackWrite(
    updateDoc(
      floorDoc(floor.id),
      'memberIds', arrayUnion(uid),
      new FieldPath('roles', uid), role,
      new FieldPath('names', uid), myName,
      new FieldPath('invites', key), deleteField(),
      'inviteEmails', arrayRemove(key),
      'updatedAt', serverTimestamp(),
    ),
  );
}

/** Owner: change a member's role. */
export function setMemberRole(floorId: string, uid: string, role: FloorRole): Promise<void> {
  return trackWrite(updateDoc(floorDoc(floorId), new FieldPath('roles', uid), role, 'updatedAt', serverTimestamp()));
}

/**
 * The owner hands the list to another member (28 Oct 2026): `ownerUid` moves,
 * the new owner is an editor, the previous owner stays as an editor. The rules
 * (`transfersOwnership`) accept exactly this and nothing else in the write.
 */
export function transferOwnership(floorId: string, newOwnerUid: string): Promise<void> {
  return trackWrite(
    updateDoc(floorDoc(floorId), 'ownerUid', newOwnerUid, new FieldPath('roles', newOwnerUid), 'edit', 'updatedAt', serverTimestamp()),
  );
}

/** Owner removes a member, or a member leaves. */
export function removeMember(floorId: string, uid: string): Promise<void> {
  return trackWrite(
    updateDoc(
      floorDoc(floorId),
      'memberIds', arrayRemove(uid),
      new FieldPath('roles', uid), deleteField(),
      new FieldPath('names', uid), deleteField(),
      'updatedAt', serverTimestamp(),
    ),
  );
}

// ── Restore points (2026-10-16) ───────────────────────────────────────────

function readRestoreMeta(id: string, data: DocumentData): RestorePointMeta {
  const kind = data.kind === 'edisi' || data.kind === 'pulihkan' ? data.kind : 'tempel';
  return {
    id,
    kind,
    label: str(data.label),
    createdAt: str(data.createdAt),
    createdBy: str(data.createdBy),
    editionId: str(data.editionId),
    scope: data.scope === 'active' ? 'active' : 'touched',
    count: typeof data.count === 'number' ? data.count : 0,
  };
}

/** The latest points, newest first (meta only; the patients are read when one is opened). */
export function subscribeRestorePoints(floorId: string, callback: (points: RestorePointMeta[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(floorRestoresCol(floorId), orderBy('createdAt', 'desc'), limit(KEEP_POINTS)),
    (snapshot) => callback(snapshot.docs.map((d) => readRestoreMeta(d.id, d.data()))),
    onError,
  );
}

/** The point saved with an edition, if any: one read on demand, so Riwayat need not listen for points. */
export async function readEditionPoint(floorId: string, editionId: string): Promise<RestorePointMeta | null> {
  const snapshot = await getDocs(query(floorRestoresCol(floorId), where('editionId', '==', editionId), limit(1)));
  const d = snapshot.docs[0];
  return d ? readRestoreMeta(d.id, d.data()) : null;
}

/**
 * Save a point: its parts, then its meta, in one batch (all or nothing). The
 * id is returned at once, before the server confirms — the paste that follows
 * is not held up by it, and Firestore applies the two writes in order.
 */
export function saveRestorePoint(floorId: string, point: Omit<RestorePoint, 'id'>): string {
  const ref = doc(floorRestoresCol(floorId));
  const parts = toParts(point);
  const batch = writeBatch(ref.firestore);
  parts.forEach((json, n) => batch.set(floorRestorePartDoc(floorId, ref.id, n), { json }));
  batch.set(ref, {
    kind: point.kind,
    label: point.label,
    createdAt: point.createdAt,
    createdBy: point.createdBy,
    editionId: point.editionId,
    scope: point.scope,
    count: point.patients.length + point.added.length,
    parts: parts.length,
    savedAt: serverTimestamp(),
  });
  void trackWrite(batch.commit()).then(() => pruneRestorePoints(floorId)).catch(() => undefined);
  return ref.id;
}

export async function readRestorePoint(floorId: string, meta: RestorePointMeta): Promise<RestorePoint> {
  const snapshot = await getDocs(floorRestorePartsCol(floorId, meta.id));
  const parts = snapshot.docs
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((d) => str(d.data().json));
  const { count: _count, ...rest } = meta;
  return { ...rest, ...fromParts(parts, readRosterPatient) };
}

/** Older points beyond KEEP_POINTS, with their parts. Best effort. */
async function pruneRestorePoints(floorId: string): Promise<void> {
  // One aggregate read says whether anything is over; the old way read every point on every save.
  const all = query(floorRestoresCol(floorId));
  const over = (await getCountFromServer(all)).data().count - KEEP_POINTS;
  if (over <= 0) return;
  const old = (await getDocs(query(all, orderBy('createdAt', 'asc'), limit(over)))).docs;
  const batch = writeBatch(floorDoc(floorId).firestore);
  for (const d of old.slice(0, 40)) {
    const parts = typeof d.data().parts === 'number' ? (d.data().parts as number) : 1;
    for (let n = 0; n < parts; n += 1) batch.delete(floorRestorePartDoc(floorId, d.id, n));
    batch.delete(d.ref);
  }
  await trackWrite(batch.commit());
}

/**
 * Apply a restore plan: each reverted patient written back WHOLE (its earlier
 * document, with the restore appended to its log), each later arrival erased.
 * Batched per 400 writes, as a paste is.
 */
export async function applyRestore(floorId: string, plan: RestorePlan, log: StatusChange): Promise<void> {
  const writes: Array<{ kind: 'set'; patient: RosterPatient } | { kind: 'delete'; key: string }> = [
    ...plan.revert.map((r) => ({ kind: 'set' as const, patient: restored(r.patient, log) })),
    ...plan.remove.map((p) => ({ kind: 'delete' as const, key: p.key })),
  ];
  for (let i = 0; i < writes.length; i += 400) {
    const batch = writeBatch(floorDoc(floorId).firestore);
    for (const write of writes.slice(i, i + 400)) {
      if (write.kind === 'delete') batch.delete(floorPatientDoc(floorId, write.key));
      else {
        const { key, ...data } = write.patient;
        batch.set(floorPatientDoc(floorId, key), { ...plain(data), updatedAt: serverTimestamp() });
      }
    }
    await trackWrite(batch.commit());
  }
}
