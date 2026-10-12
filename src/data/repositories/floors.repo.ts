import {
  addDoc,
  arrayRemove,
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

import { floorDayDoc, floorDaysCol, floorDoc, floorsCol } from '../paths';
import { trackWrite } from '../syncStatus';
import type { FloorDay, FloorDoc, FloorRole, PatientEdit } from '@/domain/floorList/floor';
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
    manual: record(data.manual, readPatient),
  };
}

function readPatient(raw: unknown): FloorPatient | null {
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

function readEdit(raw: unknown): PatientEdit | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  const out: PatientEdit = {};
  if (typeof e.junior === 'string') out.junior = e.junior;
  if (typeof e.chief === 'string') out.chief = e.chief;
  if (e.discharge === 'today' || e.discharge === 'tomorrow' || e.discharge === 'none') out.discharge = e.discharge;
  if (e.hidden === true) out.hidden = true;
  if (e.keep === true) out.keep = true;
  return out;
}

export function readDay(date: string, data: DocumentData): FloorDay {
  return {
    date,
    time: str(data.time) || '04.00',
    chief: str(data.chief),
    patients: record(data.patients, readPatient),
    edits: record(data.edits, readEdit),
  };
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

/** The days a list reads (D-2…D). `in` holds at most 30 values; 3 are used. */
export function subscribeDays(floorId: string, dates: string[], callback: (days: FloorDay[]) => void, onError: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(floorDaysCol(floorId), where('date', 'in', dates)),
    (snapshot) => callback(snapshot.docs.map((d) => readDay(d.id, d.data()))),
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
      manual: {},
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

/** File reports under their sent date, one patient leaf each. */
export function writeReports(floorId: string, date: string, patients: readonly FloorPatient[]): Promise<void> {
  const data: DocumentData = { date, updatedAt: serverTimestamp(), patients: {} };
  for (const patient of patients) (data.patients as DocumentData)[patient.key] = plain(patient);
  return trackWrite(setDoc(floorDayDoc(floorId, date), data, { merge: true }));
}

/** One patient's edit for one day: merged field by field; `null` clears a field. */
export function writeEdit(floorId: string, date: string, key: string, edit: Record<string, string | boolean | null>): Promise<void> {
  const fields: DocumentData = {};
  for (const [name, value] of Object.entries(edit)) fields[name] = value === null ? deleteField() : value;
  return trackWrite(setDoc(floorDayDoc(floorId, date), { date, updatedAt: serverTimestamp(), edits: { [key]: fields } }, { merge: true }));
}

export function writeDayFields(floorId: string, date: string, fields: { time?: string; chief?: string }): Promise<void> {
  return trackWrite(setDoc(floorDayDoc(floorId, date), { date, updatedAt: serverTimestamp(), ...fields }, { merge: true }));
}

/** A hand-entered patient (12.10): one leaf on the floor document. */
export function writeManual(floorId: string, patient: FloorPatient): Promise<void> {
  return trackWrite(updateDoc(floorDoc(floorId), new FieldPath('manual', patient.key), plain(patient), 'updatedAt', serverTimestamp()));
}

export function removeManual(floorId: string, key: string): Promise<void> {
  return trackWrite(updateDoc(floorDoc(floorId), new FieldPath('manual', key), deleteField(), 'updatedAt', serverTimestamp()));
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
