import {
  addDoc,
  arrayRemove,
  getDoc,
  getDocs,
  limit,
  orderBy,
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
  type Unsubscribe,
} from 'firebase/firestore';

import { floorDaysCol, floorDoc, floorEditionsCol, floorPatientDoc, floorPatientsCol, floorsCol } from '../paths';
import { trackWrite } from '../syncStatus';
import type { Edition, FloorDoc, FloorRole, RosterPatient, StatusChange } from '@/domain/floorList/floor';
import type { FloorPatient } from '@/domain/floorList/report';

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
  };
}

export function readPatient(raw: unknown): FloorPatient | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.key !== 'string' || typeof p.full !== 'string') return null;
  const discharge = p.discharge === 'today' || p.discharge === 'tomorrow' ? p.discharge : null;
  return {
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
    ...(p.manualFields && typeof p.manualFields === 'object'
      ? {
          manualFields: {
            diagnosis: str((p.manualFields as Record<string, unknown>).diagnosis),
            terapi: str((p.manualFields as Record<string, unknown>).terapi),
            plan: str((p.manualFields as Record<string, unknown>).plan),
          },
        }
      : {}),
  };
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
  const colour = data.colour === 'h1' || data.colour === 'today' ? data.colour : 'none';
  return {
    key,
    report: { ...report, key },
    status,
    pindahKe: str(data.pindahKe),
    leftAt: str(data.leftAt),
    colour,
    dischargeDate: str(data.dischargeDate),
    junior: str(data.junior),
    chief: str(data.chief),
    dismissed: str(data.dismissed),
    addedAt: str(data.addedAt),
    log: readLog(data.log),
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

/** The floor's roster: every patient document, on the floor or gone. */
export function subscribeRoster(floorId: string, callback: (roster: RosterPatient[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    floorPatientsCol(floorId),
    (snapshot) =>
      callback(snapshot.docs.map((d) => readRosterPatient(d.id, d.data())).filter((p): p is RosterPatient => p !== null)),
    onError,
  );
}

/** The latest sent editions (newest first). */
export function subscribeEditions(floorId: string, callback: (editions: Edition[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(floorEditionsCol(floorId), orderBy('createdAt', 'desc'), limit(60)),
    (snapshot) => callback(snapshot.docs.map((d) => readEdition(d.id, d.data()))),
    onError,
  );
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
  fields: Partial<Pick<RosterPatient, 'status' | 'pindahKe' | 'leftAt' | 'colour' | 'dischargeDate' | 'junior' | 'chief' | 'dismissed'>>,
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

export function saveEdition(floorId: string, edition: Omit<Edition, 'id'>): Promise<string> {
  return trackWrite(addDoc(floorEditionsCol(floorId), { ...plain(edition), savedAt: serverTimestamp() })).then((ref) => ref.id);
}

export function writeChiefs(floorId: string, chiefs: string): Promise<void> {
  return trackWrite(updateDoc(floorDoc(floorId), 'chiefs', chiefs, 'updatedAt', serverTimestamp()));
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
