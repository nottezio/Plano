import { dpjpById } from '@/domain/dpjp';
import type { SectionTitles } from './analysis';
import { tagsOf, type FloorMark } from './marks';
import { nameKey } from './slaber';
import { dischargeFlag, soapStamp, usulH1, type DischargeFlag, type FloorPatient } from './report';

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
  /** The chief who takes the floor's patients in jam dinas (24 Oct 2026, `chiefHandover.ts`); '' = not set. */
  chiefBangsal: string;
  /**
   * The floor's junior residents, comma-separated (12.12, Avi: "a floor
   * roster so the app recognises the residents' names"). Names read from a
   * SOAP or a sent list are matched to it (a split or mistyped name → the
   * roster spelling).
   */
  juniors: string;
  /** The floor's own colours besides red/green (13.7, `marks.ts`). */
  marks: FloorMark[];
  /** The names the editors gave Analisis sections (26 Oct 2026, `analysis.ts`); {} = the defaults. */
  analysisTitles: SectionTitles;
}

/** On the floor, or gone (and how). */
export type RosterStatus = 'dirawat' | 'pulang' | 'pindah';

/** The colour set by hand: none, red (H-1), green (pulang hari ini). Floor marks are tags (13.10). */
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
  /**
   * The day (ISO) an "usul H-1" was marked, '' = none (26 Oct 2026, Avi: the
   * resident proposes H-1, the supervisor may not visit that day). Tracked and
   * shown in Analisis, never coloured: a proposal is not a decision. Closed by
   * marking H-1 or pulang (`colourFields`), or by hand.
   */
  usulH1: string;
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
  /**
   * Who holds the patient (13.9): '' = read from the text (`divisionOf`),
   * '-' = the ward residents, else a division ("Aritmia"). A patient of
   * another department consulted to a cardiology DIVISION is held by that
   * division's resident: listed, not followed up by the floor's residents.
   */
  division: string;
  /**
   * The floor's marks (ids) set on this patient by hand, and the automatic
   * ones turned off for it (13.10). A tag never colours the identity: red /
   * green stay the discharge colour, the tag carries its own colour.
   */
  tags: string[];
  tagsOff: string[];
  /**
   * The residents' handover notes (13.14, Avi: "Operkan ke tmn lain" and
   * "Ganti chief" in the Word residents page, noted on the patient): to whom
   * the patient is handed over, and the new chief. '' = none.
   */
  operkan: string;
  gantiChief: string;
  /**
   * When the Chief Bangsal suggestion was dismissed (ISO; '' = never). Hides
   * it until the next jam dinas; for a patient without a chief, for good.
   */
  chiefDismissed: string;
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

/**
 * A hand mark, stored as the DATE it means (13.16). `colour: 'h1'` kept alone
 * is a stage: red the day it is set and red forever, never turning green on
 * the day itself. As `dischargeDate` it ages by itself, like the board's
 * `dischargePlannedFor`. `date` is the list date the mark is set on.
 */
export function colourFields(mark: ColourMark, date: string): { colour: 'none'; dischargeDate: string; usulH1?: '' } {
  const dischargeDate = mark === 'h1' ? addDays(date, 1) : mark === 'today' ? date : '';
  // A decision closes an open usul H-1; "Tanpa warna" is not a decision about it.
  return mark === 'none' ? { colour: 'none', dischargeDate } : { colour: 'none', dischargeDate, usulH1: '' };
}

/** An usul H-1 marked on `date` (ISO): tracked, never coloured (26 Oct 2026). */
export function usulFields(date: string): { usulH1: string } {
  return { usulH1: date };
}

/**
 * "Usul H-1" picked in the Warna select (26 Oct 2026): the patient is marked
 * usul and any date-based colour is cleared, since the select holds one state.
 */
export function usulMarkFields(date: string): { colour: 'none'; dischargeDate: ''; usulH1: string } {
  return { colour: 'none', dischargeDate: '', usulH1: date };
}

/** "Tanpa warna" picked by hand: no colour, planned date and usul all cleared. */
export function clearMarkFields(): { colour: 'none'; dischargeDate: ''; usulH1: '' } {
  return { colour: 'none', dischargeDate: '', usulH1: '' };
}

/** An usul H-1 is waiting for the supervisor: marked, and the patient still on the floor. */
export function usulOpen(patient: Pick<RosterPatient, 'usulH1' | 'status'>): boolean {
  return patient.status === 'dirawat' && Boolean(patient.usulH1);
}

/** Days the usul H-1 has been open on `date`, or null when there is none. */
export function usulDays(patient: Pick<RosterPatient, 'usulH1'>, date: string): number | null {
  if (!patient.usulH1) return null;
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${patient.usulH1}T00:00:00Z`)) / 86_400_000);
}

/** What the "Warna" select shows on `date`: the colour the list would print. */
export function colourMark(patient: Pick<RosterPatient, 'colour' | 'dischargeDate'>, date: string): ColourMark {
  const flag = colourOn(patient, date);
  return flag === 'tomorrow' ? 'h1' : flag === 'today' ? 'today' : 'none';
}

/** The select's value: a colour, or 'usul' while an usul H-1 is open and nothing has a colour. */
export type ColourChoice = ColourMark | 'usul';
export function colourChoice(patient: Pick<RosterPatient, 'colour' | 'dischargeDate' | 'usulH1' | 'status'>, date: string): ColourChoice {
  const mark = colourMark(patient, date);
  return mark === 'none' && usulOpen(patient) ? 'usul' : mark;
}

/**
 * A mark stored the old way (`colour` and no date) as a date, read from the
 * log: the local day of its last "H-1" / "Pulang hari ini" entry. '' when the
 * log has none — the mark then stays as it was.
 */
export function legacyColourDate(colour: ColourMark, log: readonly StatusChange[]): string {
  if (colour === 'none') return '';
  const marked = [...log].reverse().find((change) => /^(?:H-1|Pulang hari ini)/.test(change.what));
  const day = marked ? localOf(marked.at).slice(0, 10) : '';
  return day ? colourFields(colour, day).dischargeDate : '';
}

/** What the roster entry looks like on the list: residents and colour applied. */
/**
 * A resident's name as the roster spells it (12.12). Lists are typed in a
 * hurry: a name split by a space, lower case, one letter off, a short form —
 * the same person. A name
 * matches a roster name when they are equal ignoring case, spaces and
 * punctuation, or (5+ letters) one letter apart, or one is the start of the
 * other (3+ letters) — and only when exactly ONE roster name matches, so two
 * similar residents are never merged. No roster, or no match: as written.
 */
export function rosterName(name: string, roster: readonly string[]): string {
  const squash = (value: string): string => value.toLowerCase().replace(/[^a-z]/g, '');
  const key = squash(name);
  if (!key || roster.length === 0) return name;
  const exact = roster.filter((entry) => squash(entry) === key);
  if (exact.length === 1) return exact[0]!;
  if (exact.length > 1) return name;
  const near = roster.filter((entry) => {
    const other = squash(entry);
    if (!other) return false;
    if (key.length >= 3 && other.length >= 3 && (other.startsWith(key) || key.startsWith(other))) return true;
    return Math.min(key.length, other.length) >= 5 && oneEditApart(key, other);
  });
  return near.length === 1 ? near[0]! : name;
}

function oneEditApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Cardiology divisions a consult can go to instead of the ward (13.9). */
export const DIVISIONS = ['Aritmia', 'Intervensi', 'Imaging', 'Vaskular', 'Prevensi', 'Pediatri'] as const;
const DIVISION_RE = new RegExp(`\\bKJS\\s+(?:divisi\\s+)?(${DIVISIONS.join('|')})\\b`, 'i');

/**
 * The division holding this patient, or '' (the ward residents). Set by hand;
 * else (13.10) only for a patient the ward does NOT report on — known from a
 * sent list or entered by hand, with no ward junior written — whose text
 * names the division ("… - KJS ARITMIA"); or "KJS" for a patient whose only
 * cardiology DPJP is a consultant (utama of another department, listed only
 * under a KJS heading). A SOAP from the floor group means the ward follows
 * the patient: never a division by itself (13.9 read it from any text, so a
 * ward patient of ZD with a KJS Aritmia consult was taken off the ward).
 */
export function divisionOf(patient: Pick<RosterPatient, 'division' | 'report' | 'junior'>): string {
  if (patient.division === '-') return '';
  if (patient.division) return patient.division;
  const report = patient.report;
  if (!report.fromList && !report.manual) return '';
  if (patient.junior || report.junior) return '';
  const found = DIVISION_RE.exec(`${report.identity}\n${report.full.slice(0, 600)}`);
  if (found) return DIVISIONS.find((d) => d.toLowerCase() === found[1]!.toLowerCase()) ?? '';
  return !report.dpjpId && report.kjsDpjpIds.length > 0 ? 'KJS' : '';
}

/** "Divisi Aritmia", or "KJS" as it is. */
export const holderLabel = (division: string): string => ((DIVISIONS as readonly string[]).includes(division) ? `Divisi ${division}` : division);

export function effective(
  patient: RosterPatient,
  floor: Pick<FloorDoc, 'nicknames' | 'chiefs'> & { juniors?: string | undefined; marks?: readonly FloorMark[] | undefined },
  date: string,
  /** Not on the previous day's list (13.10, the "pasien baru" rule). */
  isNew = false,
): FloorPatient {
  const report = patient.report;
  const { tags: _stored, division: _was, ...rest } = report;
  const division = divisionOf(patient);
  let junior = patient.junior;
  let chief = patient.chief;
  if (!division) {
    const chiefs = chiefsOf(floor.chiefs);
    const juniors = chiefsOf(floor.juniors ?? '');
    // Either roster may hold the name: a chief writes himself as "FU" at times.
    const everyone = [...juniors, ...chiefs];
    junior = rosterName(patient.junior || report.junior || floor.nicknames[report.sender] || report.senderNick || '', juniors.length > 0 ? everyone : []);
    const written = patient.chief || report.chief;
    chief = written ? rosterName(written, chiefs.length > 0 ? everyone : []) : chiefs.length === 1 ? chiefs[0]! : '';
  }
  const tags = tagsOf(floor.marks ?? [], patient.tags, patient.tagsOff, {
    isNew,
    dpjpId: report.dpjpId,
    btkv: report.btkv,
    kjs: report.kjsDpjpIds.length > 0,
    division: Boolean(division),
    junior,
  });
  /*
    Held by a division (13.14, Avi: Papalangi and Manutte in Prof. MZ's box —
    utama of another department, MZ only as KJS Aritmia): the cardiologist
    written on the line is the CONSULTANT, not the utama. Filed as that
    DPJP's KJS — the KJS part of the box, counted "+ n KJS" — with the code
    still printed on the line as written.
  */
  const filing =
    division && report.dpjpId
      ? {
          dpjpId: null,
          kjsDpjpIds: [report.dpjpId, ...report.kjsDpjpIds.filter((id) => id !== report.dpjpId)],
          dpjpCode: report.dpjpCode || (dpjpById(report.dpjpId)?.initials ?? ''),
        }
      : {};
  const notes = {
    ...(patient.operkan ? { operkan: patient.operkan } : {}),
    ...(patient.gantiChief ? { gantiChief: patient.gantiChief } : {}),
  };
  return {
    ...rest,
    ...filing,
    junior,
    chief,
    discharge: colourOn(patient, date),
    ...(usulOpen(patient) ? { usul: true } : {}),
    ...(division ? { division } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...notes,
  };
}

/**
 * Whether the SOAP on the list is current (13.11, Avi: mid-day the list maker
 * re-pastes to bring the SOAPs up to date, and needs to see which are):
 * 'baru' — a SOAP from the group arrived after the last list was sent;
 * 'lama' — the latest SOAP is from before the list date (none today yet).
 * Hand entries and list lines are neither: they are not SOAPs.
 */
export function soapState(report: FloorPatient, date: string, lastSent: string): 'baru' | 'lama' | null {
  if (report.manual || report.fromList || !report.sentAt) return null;
  // An edit in Plano counts as the SOAP being brought up to date (`sentAt` stays the message's).
  const at = soapStamp(report);
  if (lastSent && at > lastSent) return 'baru';
  if (at.slice(0, 10) < date) return 'lama';
  return null;
}

export interface RosterView {
  /** On the floor, residents and colour applied. */
  active: FloorPatient[];
  /** Left the floor (newest first). */
  left: RosterPatient[];
}

/**
 * `previous`: the keys on the last list sent before this date (the
 * "pasien baru" rule); without one, a patient added on this date is new.
 */
export function rosterView(
  floor: FloorDoc,
  roster: readonly RosterPatient[],
  date: string,
  previous?: ReadonlySet<string> | null,
  /** When the last list was sent (local stamp): SOAPs after it are marked (13.11). */
  lastSent?: string,
): RosterView {
  /*
    Without a previous list, "new" = added on the list date — on the LOCAL
    clock (2026-10-16). `addedAt` is UTC: a patient added 00:00–08:00 WITA
    (the 04:00 list-making hours) carried yesterday's UTC date and never got
    the "Pasien baru" tag.
  */
  const isNew = (p: RosterPatient): boolean => (previous ? !previous.has(p.key) : localOf(p.addedAt).slice(0, 10) === date);
  return {
    active: roster
      .filter((p) => p.status === 'dirawat')
      .map((p) => {
        const seen = effective(p, floor, date, isNew(p));
        const soap = soapState(p.report, date, lastSent ?? '');
        return soap ? { ...seen, soap } : seen;
      }),
    left: roster.filter((p) => p.status !== 'dirawat').sort((a, b) => (a.leftAt < b.leftAt ? 1 : -1)),
  };
}

/**
 * A suggestion from the SOAP's Plan, or null: shown as a chip, applied only
 * on a tap. Not offered when the hand-set state already says the same, or the
 * suggestion for this very report was dismissed.
 */
export function suggestionFor(patient: RosterPatient, date: string): 'h1' | 'today' | 'usul' | null {
  if (patient.status !== 'dirawat' || patient.dismissed === patient.report.sentAt) return null;
  const read = dischargeFlag(patient.report.body);
  if (!read) {
    // "Usul H-1" only proposes: asked once, and not while a colour already says more.
    const open = usulH1(patient.report.body) && !patient.usulH1 && colourOn(patient, date) === null;
    return open ? 'usul' : null;
  }
  // "H-1" written yesterday means today; read relative to the report's day.
  const day = patient.report.sentAt.slice(0, 10);
  const flag = read === 'tomorrow' && day && day < date ? 'today' : read === 'today' && day && day < date ? null : read;
  if (!flag) return null;
  const mark = flag === 'tomorrow' ? 'h1' : 'today';
  if (colourOn(patient, date) === flag) return null;
  return mark;
}

export interface SuggestionAction {
  label: string;
  /** Written to the roster entry when tapped. */
  fields: ReturnType<typeof colourFields> | ReturnType<typeof usulFields>;
  /** The log line. */
  what: string;
}

/** The words of a suggestion chip: "Plan menyebut …". */
export function suggestionWords(mark: 'h1' | 'today' | 'usul'): string {
  return mark === 'usul' ? 'usul H-1 (belum pasti)' : mark === 'h1' ? 'H-1' : 'pulang hari ini';
}

/**
 * The taps a suggestion chip offers (26 Oct 2026), shared by the Atur panel
 * and the list at the top of the List Maker. Marking H-1 or pulang closes an
 * open usul (`colourFields`); the Plan is never applied without a tap.
 */
export function suggestionActions(patient: RosterPatient, mark: 'h1' | 'today' | 'usul', date: string): SuggestionAction[] {
  if (mark === 'usul') {
    return [
      { label: 'Tandai usul', fields: usulFields(date), what: 'Usul H-1 (dari saran Plan)' },
      { label: 'Sudah pasti H-1', fields: colourFields('h1', date), what: 'H-1 (dari saran Plan)' },
    ];
  }
  if (mark === 'h1' && patient.usulH1) {
    return [{ label: 'Usul disetujui — tandai H-1', fields: colourFields('h1', date), what: 'H-1 (usul disetujui)' }];
  }
  return [{ label: 'Tandai', fields: colourFields(mark, date), what: mark === 'h1' ? 'H-1 (dari saran Plan)' : 'Pulang hari ini (dari saran Plan)' }];
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
    usulH1: '',
    junior: '',
    chief: '',
    dismissed: '',
    placedAt: '',
    division: '',
    tags: [],
    tagsOff: [],
    operkan: '',
    gantiChief: '',
    chiefDismissed: '',
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
  /**
   * Of `fresh`, key → why the patient has probably already gone (13.7):
   * proposed UNticked. An export spans days, so its oldest SOAPs belong to
   * patients discharged since.
   */
  doubt: Record<string, string>;
}

const HOUR = 3_600_000;
const stampMs = (stamp: string): number => Date.parse(`${stamp.length === 16 ? stamp : stamp.slice(0, 16)}:00Z`);
const dmy = (day: string): string => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

/**
 * Why a patient new to the roster has probably left already, or '' (13.7).
 * Read against the paste itself — its newest message is "now" — so an old
 * export is judged on its own days:
 *
 * - a newer sent list (any list message in the paste after the patient's last
 *   report) does not have the patient;
 * - the Plan said "pulang hari ini" on an earlier day, or "H-1" two days
 *   earlier or more;
 * - no report for 36 hours while others kept coming (a daily SOAP missed).
 *
 * Being on the newest list clears the last two: the list maker kept them.
 */
function doubtFor(report: FloorPatient, seenAt: string, newest: string, list: { at: string; keys: Set<string> } | null): string {
  const onList = list !== null && list.keys.has(report.key);
  if (list && !onList && seenAt < list.at) return `tidak ada di list ${dmy(list.at)} ${list.at.slice(11, 16)}`;
  if (onList) return '';
  const day = report.sentAt.slice(0, 10);
  const newestDay = newest.slice(0, 10);
  const plan = report.fromList ? null : dischargeFlag(report.body);
  if (plan === 'today' && day < newestDay) return `plan pulang ${dmy(day)}`;
  if (plan === 'tomorrow' && addDays(day, 1) < newestDay) return `plan pulang ${dmy(addDays(day, 1))}`;
  if (stampMs(newest) - stampMs(seenAt) > 36 * HOUR) return `SOAP terakhir ${dmy(day)}`;
  return '';
}

/**
 * What a paste would change. Nobody is ever removed: a patient missing from
 * the paste is simply not in it. Within one paste the latest report per
 * patient counts.
 */
export function pasteDiff(roster: readonly RosterPatient[], reports: readonly FloorPatient[]): PasteDiff {
  const latest = new Map<string, FloorPatient>();
  // When each patient was last mentioned at all (SOAP or list line).
  const seen = new Map<string, string>();
  let newest = '';
  for (const report of reports) {
    if (report.sentAt > (seen.get(report.key) ?? '')) seen.set(report.key, report.sentAt);
    if (report.sentAt > newest) newest = report.sentAt;
    const before = latest.get(report.key);
    // Within one paste a SOAP outranks a sent list's line, whatever the time.
    const outranks = before && Boolean(before.fromList) !== Boolean(report.fromList) ? !report.fromList : undefined;
    if (!before || (outranks ?? report.sentAt >= before.sentAt)) latest.set(report.key, report);
  }
  // The newest sent list: every line of the list messages within 3 hours of
  // the last one (a list split over several messages is one list).
  const listAt = reports.reduce((at, r) => (r.fromList && r.sentAt > at ? r.sentAt : at), '');
  const list = listAt
    ? {
        at: listAt,
        keys: new Set(reports.filter((r) => r.fromList && stampMs(listAt) - stampMs(r.sentAt) <= 3 * HOUR).map((r) => r.key)),
      }
    : null;
  const byKey = new Map(roster.map((p) => [p.key, p]));
  /*
    A patient entered by hand without an RM is filed under "manual:<room>:<name>",
    so the group's SOAP for them (filed under "rm:<n>") never met it: the paste
    proposed a second patient (13.13, Avi: "can a pasted SOAP update a manual
    patient?"). Also found by RM (the entry, once updated, keeps its first key)
    and, for hand entries only, by name in the same room.
  */
  const rmOf = (rm: string): string => rm.replace(/\D/g, '').replace(/^0+/, '');
  const byRm = new Map(roster.filter((p) => p.report.rm).map((p) => [rmOf(p.report.rm), p]));
  const handByName = new Map(roster.filter((p) => p.report.manual && !p.report.rm).map((p) => [nameKey(p.report.name), p]));
  const find = (report: FloorPatient): RosterPatient | undefined => {
    const direct = byKey.get(report.key) ?? (report.rm ? byRm.get(rmOf(report.rm)) : undefined);
    if (direct || report.fromList) return direct;
    const hand = handByName.get(nameKey(report.name));
    return hand && (!hand.report.room || !report.room || hand.report.room === report.room) ? hand : undefined;
  };
  const diff: PasteDiff = { fresh: [], updated: [], moved: [], readmit: [], unchanged: 0, doubt: {} };
  for (const report of latest.values()) {
    const before = find(report);
    if (!before) {
      diff.fresh.push(report);
      const why = doubtFor(report, seen.get(report.key) ?? report.sentAt, newest, list);
      if (why) diff.doubt[report.key] = why;
      continue;
    }
    const stored = before.report;
    // An edit made in Plano survives a re-paste of the same message; only a newer one replaces it.
    const newer =
      (stored.fromList && !report.fromList) ||
      // A SOAP replaces a hand-entered patient (13.11: the pediatri patient
      // who later gets reports in the group was frozen at the hand entry).
      (stored.manual && !report.fromList) ||
      report.sentAt > stored.sentAt || (report.sentAt === stored.sentAt && stored.edited !== true && report.full !== stored.full);
    // The same text again (a re-paste, or a copied message stamped "now") changes nothing.
    const same = report.full === stored.full && !stored.manual;
    // A list line never replaces a real SOAP or a hand entry; a SOAP always replaces a list line.
    if (!newer || same || (report.fromList && (!stored.fromList || stored.manual))) {
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
  // A message copied on its own has no sender line: keep who wrote the last
  // one, so the junior read from the sender's nickname does not go blank.
  const who = report.sender ? {} : { sender: stored.sender, senderNick: stored.senderNick };
  return { ...report, ...who, ...(acceptMove ? {} : { room: stored.room, bed: stored.bed }) };
}

/**
 * A stored ISO time (UTC, "2026-10-13T10:56:…Z") on the local clock
 * (13.14: "disimpan 10:56" for a list saved at 18:56 in Makassar — the UTC
 * text was sliced as if it were local). '' when unreadable.
 */
export function localOf(iso: string): string {
  const at = new Date(iso);
  return iso && !Number.isNaN(at.getTime()) ? localStamp(at) : '';
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
