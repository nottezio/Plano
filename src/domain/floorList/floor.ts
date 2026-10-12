import { dischargeFlag, type DischargeFlag, type FloorPatient } from './report';

/**
 * A shared floor list (12.8; roster since 12.12).
 *
 * WHY A ROSTER (Avi, 12-12): the floor changes all day — new patients,
 * discharges, transfers to ICU/HCU/CVCU — and the list maker decides each
 * change. 12.8–12.11 inferred it: red/green read from the Plan text, patients
 * dropped when their reports stopped or their plan said "pulang". A proposal
 * ("usul H-1") read as a decision, a late SOAP dropping a patient: on a list
 * that goes to consultants, too risky. Now:
 *
 * - the ROSTER is the floor's patients, one document each
 *   (`floors/{id}/patients/{key}`): the latest SOAP (`report`) plus what the
 *   list maker decided (status, colour, planned discharge date, residents);
 * - a paste only UPDATES SOAPs and PROPOSES additions — nobody is removed;
 * - status changes only by hand, each logged (who, when) and undoable;
 * - the SOAP is a SUGGESTION source only (`suggestionFor`): a chip, never
 *   applied without a tap;
 * - an EDITION (`floors/{id}/editions/{id}`) is a sent list: free-text time,
 *   the message, and the roster as it stood (for Word and history).
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
  /** The floor's chiefs now, comma-separated (several allowed, 12.11). */
  chiefs: string;
}

/** On the floor, or gone (and how). */
export type RosterStatus = 'dirawat' | 'pulang' | 'pindah';

/** The colour set by hand: none, red (H-1), green (pulang hari ini). */
export type ColourMark = 'none' | 'h1' | 'today';

export interface StatusChange {
  at: string;
  by: string;
  /** "Pulang", "Pindah ke ICU", "H-1", "Rencana pulang 14/10/2026", "Masuk list"… */
  what: string;
}

export interface RosterPatient {
  key: string;
  /** The latest SOAP (from a paste, edited, or entered by hand). */
  report: FloorPatient;
  status: RosterStatus;
  /** Where a 'pindah' patient went ("ICU", "CVCU", "Lantai 5"…). */
  pindahKe: string;
  /** When the patient left (ISO date-time), for the Pindah/Pulang note. */
  leftAt: string;
  colour: ColourMark;
  /** Planned discharge (ISO date): red the day before, green on the day. */
  dischargeDate: string;
  /** Overrides; '' = from the SOAP / nickname / floor chief. */
  junior: string;
  chief: string;
  /** `report.sentAt` whose suggestion was dismissed. */
  dismissed: string;
  /**
   * When the room/bed was last set by hand (local "YYYY-MM-DDTHH:MM", the
   * same clock as `report.sentAt`). A SOAP sent before it still carries the
   * old room and must not move the patient back.
   */
  placedAt: string;
  addedAt: string;
  log: StatusChange[];
}

export interface Edition {
  id: string;
  date: string;
  /** Free text ("04.00", "16.00 shift", "19.30"). */
  time: string;
  text: string;
  /** The roster as sent (active patients, residents and colours applied). */
  patients: FloorPatient[];
  createdAt: string;
  createdBy: string;
}

export function chiefsOf(value: string): string[] {
  return [...new Set(value.split(/[,;\n]/).map((name) => name.trim()).filter(Boolean))];
}

export function canEdit(floor: FloorDoc, uid: string | null | undefined): boolean {
  return Boolean(uid) && (floor.ownerUid === uid || floor.roles[uid!] === 'edit');
}

export function isOwner(floor: FloorDoc, uid: string | null | undefined): boolean {
  return Boolean(uid) && floor.ownerUid === uid;
}

function addDays(date: string, n: number): string {
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + n);
  return at.toISOString().slice(0, 10);
}

/**
 * The colour shown on the list of `date`: the hand-set mark, else from the
 * planned discharge date (red the day before, green on the day and after —
 * still on the floor past the date stays green until marked Pulang).
 */
export function colourOn(patient: Pick<RosterPatient, 'colour' | 'dischargeDate'>, date: string): DischargeFlag {
  if (patient.colour === 'h1') return 'tomorrow';
  if (patient.colour === 'today') return 'today';
  const due = patient.dischargeDate;
  if (!due) return null;
  if (date >= due) return 'today';
  if (addDays(date, 1) === due) return 'tomorrow';
  return null;
}

/** What the roster entry looks like on the list: residents and colour applied. */
export function effective(patient: RosterPatient, floor: Pick<FloorDoc, 'nicknames' | 'chiefs'>, date: string): FloorPatient {
  const report = patient.report;
  const chiefs = chiefsOf(floor.chiefs);
  const junior = patient.junior || report.junior || floor.nicknames[report.sender] || report.senderNick || '';
  const chief = patient.chief || report.chief || (chiefs.length === 1 ? chiefs[0]! : '');
  return { ...report, junior, chief, discharge: colourOn(patient, date) };
}

export interface RosterView {
  /** On the floor, residents and colour applied. */
  active: FloorPatient[];
  /** Left the floor (newest first). */
  left: RosterPatient[];
}

export function rosterView(floor: FloorDoc, roster: readonly RosterPatient[], date: string): RosterView {
  return {
    active: roster.filter((p) => p.status === 'dirawat').map((p) => effective(p, floor, date)),
    left: roster.filter((p) => p.status !== 'dirawat').sort((a, b) => (a.leftAt < b.leftAt ? 1 : -1)),
  };
}

/**
 * A suggestion from the SOAP's Plan, or null: shown as a chip, applied only
 * on a tap. Not offered when the hand-set state already says the same, or the
 * suggestion for this very report was dismissed.
 */
export function suggestionFor(patient: RosterPatient, date: string): 'h1' | 'today' | null {
  if (patient.status !== 'dirawat' || patient.dismissed === patient.report.sentAt) return null;
  const read = dischargeFlag(patient.report.body);
  if (!read) return null;
  // "H-1" written yesterday means today; read relative to the report's day.
  const day = patient.report.sentAt.slice(0, 10);
  const flag = read === 'tomorrow' && day && day < date ? 'today' : read === 'today' && day && day < date ? null : read;
  if (!flag) return null;
  const mark = flag === 'tomorrow' ? 'h1' : 'today';
  if (colourOn(patient, date) === flag) return null;
  return mark;
}

export function newRosterPatient(report: FloorPatient, at: string, by: string): RosterPatient {
  return {
    key: report.key,
    report,
    status: 'dirawat',
    pindahKe: '',
    leftAt: '',
    colour: 'none',
    dischargeDate: '',
    junior: '',
    chief: '',
    dismissed: '',
    placedAt: '',
    addedAt: at,
    log: [{ at, by, what: 'Masuk list' }],
  };
}

// ── paste ──────────────────────────────────────────────────────────────────

export interface PasteDiff {
  /** Not on the roster yet: proposed for adding (ticked by default). */
  fresh: FloorPatient[];
  /** On the floor, newer SOAP: applied. */
  updated: Array<{ before: RosterPatient; report: FloorPatient }>;
  /** Of `updated`, the ones whose room/bed changed: confirmed by a tick. */
  moved: Array<{ before: RosterPatient; report: FloorPatient }>;
  /** Left the floor (Pulang/Pindah) but a newer SOAP arrived: NOT re-added unless ticked. */
  readmit: Array<{ before: RosterPatient; report: FloorPatient }>;
  /** Same or older than what is stored. */
  unchanged: number;
}

/**
 * What a paste would change. Nobody is ever removed: a patient missing from
 * the paste is simply not in it. Within one paste the latest report per
 * patient counts.
 */
export function pasteDiff(roster: readonly RosterPatient[], reports: readonly FloorPatient[]): PasteDiff {
  const latest = new Map<string, FloorPatient>();
  for (const report of reports) {
    const before = latest.get(report.key);
    if (!before || report.sentAt >= before.sentAt) latest.set(report.key, report);
  }
  const byKey = new Map(roster.map((p) => [p.key, p]));
  const diff: PasteDiff = { fresh: [], updated: [], moved: [], readmit: [], unchanged: 0 };
  for (const report of latest.values()) {
    const before = byKey.get(report.key);
    if (!before) {
      diff.fresh.push(report);
      continue;
    }
    const stored = before.report;
    // An edit made in Plano survives a re-paste of the same message; only a newer one replaces it.
    const newer =
      report.sentAt > stored.sentAt || (report.sentAt === stored.sentAt && stored.edited !== true && report.full !== stored.full);
    if (!newer || stored.manual) {
      diff.unchanged += 1;
      continue;
    }
    if (before.status !== 'dirawat') {
      diff.readmit.push({ before, report });
      continue;
    }
    diff.updated.push({ before, report });
    const placeDiffers = report.room && (report.room !== stored.room || (report.bed || '') !== (stored.bed || ''));
    // A SOAP written before the hand move still names the old room: not a move.
    if (placeDiffers && report.sentAt > before.placedAt) diff.moved.push({ before, report });
  }
  return diff;
}

/**
 * The report to store for an update: the new SOAP, but the room/bed kept as
 * they were unless the move was confirmed.
 */
export function updatedReport(stored: FloorPatient, report: FloorPatient, acceptMove: boolean): FloorPatient {
  return acceptMove ? report : { ...report, room: stored.room, bed: stored.bed };
}

/** Local wall-clock stamp, the clock WhatsApp exports use ("2026-10-12T07:05"). */
export function localStamp(at: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** Patients who left since `since` (ISO), for the separate Pindah/Pulang note. */
export function leftSince(roster: readonly RosterPatient[], since: string): RosterPatient[] {
  return roster.filter((p) => p.status !== 'dirawat' && p.leftAt && p.leftAt > since).sort((a, b) => (a.leftAt < b.leftAt ? -1 : 1));
}

/** The note itself: "Pindah ke ICU: 415 Bed 1/AFG/Tn. …", "Pulang: …". */
export function leftNote(patients: readonly RosterPatient[], line: (p: FloorPatient) => string): string {
  return patients
    .map((p) => `${p.status === 'pindah' ? `Pindah ke ${p.pindahKe || '…'}` : 'Pulang'}: ${line({ ...p.report, junior: '', chief: '' })}`)
    .join('\n');
}
