import { latestOf, onFloor, type DischargeFlag, type FloorPatient, type GonePatient } from './report';

/**
 * A shared floor list (12.8): who may see it, and the list of one day built
 * from the reports stored for the last few days plus the day's edits.
 *
 * STORAGE (`floors/{floorId}` + `floors/{floorId}/days/{date}`):
 * - each paste files every report under the day it was SENT
 *   (`days/<sentDate>.patients.<key>`), one leaf per patient, so two members
 *   pasting different messages cannot overwrite each other (pattern 5);
 * - the list of day D reads days D-2…D, keeps the latest report per patient
 *   and applies `onFloor(D)`;
 * - corrections (residents, red/green, hide, put back) are D's `edits.<key>`,
 *   apart from the reports, so a re-paste never wipes them.
 */

export type FloorRole = 'edit' | 'view';

export interface FloorDoc {
  id: string;
  name: string;
  /** The ward the denah and route are drawn from ("PJT Lantai 4"). */
  ward: string;
  ownerUid: string;
  memberIds: string[];
  /** uid → role. The owner is always 'edit'. */
  roles: Record<string, FloorRole>;
  /** Display names, uid → name, for the member list. */
  names: Record<string, string>;
  /** Lower-cased email → role, until the invitee accepts. */
  invites: Record<string, FloorRole>;
  inviteEmails: string[];
  /** WhatsApp sender as exported → nickname printed in the list ("Bima" → "Dani"). */
  nicknames: Record<string, string>;
  /**
   * Hand-entered patients (12.10), key → patient. On the floor document, not
   * a day, so they stay on every day's list until removed (they get no daily
   * report to keep them there).
   */
  manual: Record<string, FloorPatient>;
}

export interface PatientEdit {
  junior?: string;
  chief?: string;
  /** Override of the red/green read from the plan; 'none' clears it. */
  discharge?: DischargeFlag | 'none';
  /** Off the list for this day although a report keeps it on. */
  hidden?: boolean;
  /** Back on the list although `onFloor` dropped it. */
  keep?: boolean;
}

export interface FloorDay {
  date: string;
  /** Time printed on the list ("04.00"). */
  time: string;
  /**
   * The day's chief(s), comma-separated ("Didi, Malik" — 12.11: a floor can
   * have several). With ONE chief every patient without one gets it; with
   * several each patient is assigned (`edits.<key>.chief`).
   */
  chief: string;
  patients: Record<string, FloorPatient>;
  edits: Record<string, PatientEdit>;
}

export function emptyDay(date: string): FloorDay {
  return { date, time: '04.00', chief: '', patients: {}, edits: {} };
}

/** The day's chiefs as a list. */
export function chiefsOf(day: Pick<FloorDay, 'chief'>): string[] {
  return [...new Set(day.chief.split(/[,;\n]/).map((name) => name.trim()).filter(Boolean))];
}

export function canEdit(floor: FloorDoc, uid: string | null | undefined): boolean {
  return Boolean(uid) && (floor.ownerUid === uid || floor.roles[uid!] === 'edit');
}

export function isOwner(floor: FloorDoc, uid: string | null | undefined): boolean {
  return Boolean(uid) && floor.ownerUid === uid;
}

export function previousDates(date: string, count: number): string[] {
  const out: string[] = [];
  const at = new Date(`${date}T00:00:00Z`);
  for (let i = 0; i <= count; i += 1) {
    const d = new Date(at);
    d.setUTCDate(at.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** How many earlier days of reports a day's list reads. */
export const LOOKBACK_DAYS = 2;

export interface DayView {
  present: FloorPatient[];
  gone: GonePatient[];
  hidden: FloorPatient[];
}

/** Apply the floor's nicknames, the day's chief and the day's edits to one patient. */
export function withEdits(patient: FloorPatient, floor: Pick<FloorDoc, 'nicknames'>, day: FloorDay): FloorPatient {
  const edit = day.edits[patient.key] ?? {};
  // A "Junior :" line, else the floor's nickname for the sender, else the derived one.
  const junior = edit.junior ?? (patient.junior || floor.nicknames[patient.sender] || patient.senderNick || '');
  const discharge = edit.discharge === undefined ? patient.discharge : edit.discharge === 'none' ? null : edit.discharge;
  const chiefs = chiefsOf(day);
  const chief = edit.chief ?? (patient.chief || (chiefs.length === 1 ? chiefs[0]! : ''));
  return { ...patient, junior, chief, discharge };
}

/**
 * The list of `date`: reports from the stored days (oldest first, so the latest
 * wins), edits applied, then who is on the floor.
 */
export function dayView(floor: FloorDoc, days: readonly FloorDay[], date: string): DayView {
  const today = days.find((day) => day.date === date) ?? emptyDay(date);
  const window = new Set(previousDates(date, LOOKBACK_DAYS));
  const patients = latestOf(
    [
      ...days.filter((day) => window.has(day.date)).flatMap((day) => Object.values(day.patients)),
      // Hand-entered patients, from the day they were entered on.
      ...Object.values(floor.manual ?? {}).filter((patient) => !patient.sentAt || patient.sentAt.slice(0, 10) <= date),
    ]
      // Stored reports from different pastes: order by stamp only.
      .map((patient) => ({ ...patient, index: 0 }))
      .sort((a, b) => (a.sentAt < b.sentAt ? -1 : a.sentAt > b.sentAt ? 1 : 0)),
  );

  const edited = patients.map((patient) => withEdits(patient, floor, today));
  const { present, gone } = onFloor(edited, date);
  const kept = gone.filter((g) => today.edits[g.patient.key]?.keep).map((g) => g.patient);
  const all = [...present, ...kept];
  return {
    present: all.filter((patient) => !today.edits[patient.key]?.hidden),
    gone: gone.filter((g) => !today.edits[g.patient.key]?.keep),
    hidden: all.filter((patient) => today.edits[patient.key]?.hidden),
  };
}

/**
 * Which reports a paste adds or updates, per sent date: the leaves to write.
 * A report already stored with the same or a later stamp is skipped, so
 * pasting the same export twice writes nothing.
 */
export function pastePlan(
  existing: readonly FloorDay[],
  reports: readonly FloorPatient[],
  fallbackDate: string,
): { byDate: Map<string, FloorPatient[]>; added: number; updated: number; unchanged: number } {
  const stored = new Map<string, FloorPatient>();
  for (const day of existing) {
    for (const patient of Object.values(day.patients)) {
      const before = stored.get(patient.key);
      if (!before || patient.sentAt > before.sentAt) stored.set(patient.key, patient);
    }
  }
  // One paste can hold a patient several times: per sent date keep the latest.
  const perDate = new Map<string, FloorPatient>();
  for (const report of reports) {
    const date = report.sentAt.slice(0, 10) || fallbackDate;
    const id = `${date}|${report.key}`;
    const before = perDate.get(id);
    if (!before || report.sentAt >= before.sentAt) perDate.set(id, report);
  }
  const byDate = new Map<string, FloorPatient[]>();
  const addedKeys = new Set<string>();
  const updatedKeys = new Set<string>();
  const unchangedKeys = new Set<string>();
  for (const [id, report] of perDate) {
    const date = id.slice(0, id.indexOf('|'));
    const before = stored.get(report.key);
    // An edit made in Plano survives a re-paste of the same message; only a
    // newer message replaces it.
    if (
      before &&
      (before.sentAt > report.sentAt ||
        (before.sentAt === report.sentAt && (before.full === report.full || before.edited === true)))
    ) {
      unchangedKeys.add(report.key);
      continue;
    }
    if (before) updatedKeys.add(report.key);
    else addedKeys.add(report.key);
    const list = byDate.get(date) ?? [];
    list.push(report);
    byDate.set(date, list);
  }
  for (const key of addedKeys) updatedKeys.delete(key);
  for (const key of [...addedKeys, ...updatedKeys]) unchangedKeys.delete(key);
  const added = addedKeys.size;
  const updated = updatedKeys.size;
  const unchanged = unchangedKeys.size;
  return { byDate, added, updated, unchanged };
}
