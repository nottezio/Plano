import { checklistProgress, resolveCardColor, type ChecklistStates } from './checklist';
import { hariRawat } from './clinicalDate';
import { displayName, redactName } from './identity';
import { dpjpById, type Dpjp } from './dpjp';
import { dischargeStage, migrateLegacyDischarge, type DischargeStage } from './discharge';
import type {
  ChecklistItemDef,
  ClinicalDate,
  ChecklistTickState,
  Patient,
} from './types';

/**
 * SPEC F2 / F10 — everything the board decides, with no React and no Firebase
 * in scope so it can be tested directly.
 */

/** Titles a resident writes before a name; they carry no identifying value. */
const HONORIFICS = new Set([
  'tn', 'ny', 'nn', 'an', 'sdr', 'sdri', 'by', 'bp', 'ibu', 'bapak', 'tuan', 'nyonya',
]);

/**
 * SPEC 18 — the board shows initials + bed by default because full names are
 * stored and a ward computer is a shoulder-surfing environment.
 */
export function initials(name: string): string {
  const words = name
    .split(/\s+/)
    .map((word) => word.replace(/[.,]/g, ''))
    .filter(Boolean)
    .filter((word) => !HONORIFICS.has(word.toLowerCase()));

  const source = words.length > 0 ? words : name.split(/\s+/).filter(Boolean);
  const letters = source.slice(0, 3).map((word) => word.charAt(0).toUpperCase());
  return letters.length > 0 ? letters.join('.') : '—';
}

/**
 * A patient with no typed name is titled by the first line of their note
 * (see identity.ts). Initials-only mode applies to the derived title too —
 * a privacy setting that hid the name field while leaking the note's opening
 * line would be worse than no setting.
 */
export function cardTitle(patient: Patient, showInitialsOnly: boolean): string {
  const name = displayName(patient);
  if (!name) return patient.bed ? `Catatan baru · ${patient.bed}` : 'Catatan baru';

  const label = showInitialsOnly ? initials(name) : name;
  return patient.bed ? `${label} · ${patient.bed}` : label;
}

/**
 * Reads the denormalised board cache, ignoring it when it belongs to a
 * previous clinical day. That check is what makes the midnight reset work on
 * the board with no job and no network: a stale date simply reads as
 * "nothing ticked yet".
 */
export function boardTickStates(
  patient: Patient,
  items: readonly ChecklistItemDef[],
  today: ClinicalDate,
): ChecklistStates {
  const cache = patient.boardChecklist;
  const fresh = cache && cache.date === today ? cache.done : {};
  const states: Record<string, ChecklistTickState> = {};
  for (const item of items) {
    states[item.id] = { done: fresh[item.id] === true, at: null, by: null };
  }
  return states;
}

export interface BoardCard {
  /** Derived from the planned date, so it is right every morning by itself. */
  discharge: DischargeStage | null;
  patient: Patient;
  title: string;
  colorToken: string;
  hariRawat: number;
  progress: ReturnType<typeof checklistProgress>;
  /** Consultant detected from the note, for the card badge. */
  dpjp: Dpjp | null;
  /** Joint-care patient — `KJS` in the note, or two DPJP services named. */
  kjs: boolean;
  /** Chief on duty, shown on the card. */
  chief: string | null;
  preview: string;
  previewIsStale: boolean;
}

export function buildCard(
  patient: Patient,
  items: readonly ChecklistItemDef[],
  today: ClinicalDate,
  showInitialsOnly: boolean,
): BoardCard {
  const states = boardTickStates(patient, items, today);
  return {
    patient,
    title: cardTitle(patient, showInitialsOnly),
    colorToken: resolveCardColor(items, states, patient.colorOverride),
    hariRawat: hariRawat(today, patient.admittedAt),
    progress: checklistProgress(items, states),
    // Redacted when the board is in initials-only mode. Reducing the title to
    // initials while the preview under it spells the name out in full is not
    // partial protection, it is none — and a stored preview written before this
    // rule existed can still contain the name.
    // Deliberately NOT folded into `colorToken`. The card colour tracks how far
    // the round got; discharge is a different axis entirely, and overloading one
    // colour to mean both makes neither readable.
    // Derived rather than stored: a stage is a fact about today that goes
    // stale overnight, a date does not.
    discharge: dischargeStage(migrateLegacyDischarge(patient, today), today),
    chief: patient.chief?.trim() || null,
    dpjp: patient.dpjpId ? (dpjpById(patient.dpjpId) ?? null) : null,
    // Read from the preview rather than a field: KJS is stated in the note's
    // opening line, and a second place to record it is a second place for it
    // to be wrong.
    kjs: /\bKJS\b/i.test(patient.preview ?? '') || /\bKJS\b/i.test(patient.searchBlob ?? ''),
    preview: showInitialsOnly
      ? redactName(patient.preview ?? '', patient.name ?? '')
      : (patient.preview ?? ''),
    // Falling back to an older day is fine, but the card says so rather than
    // implying the note was written today.
    previewIsStale: Boolean(patient.preview) && patient.previewDate !== today,
  };
}

/** First N lines of the preview, for the card body. */
export function previewLines(preview: string, max = 4): string[] {
  return preview
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max);
}

export interface BoardFilters {
  query: string;
  wards: string[];
  labels: string[];
  /** Checklist item ids that must still be UNDONE today ("belum …" chips). */
  pendingItemIds: string[];
}

export const EMPTY_FILTERS: BoardFilters = {
  query: '',
  wards: [],
  labels: [],
  pendingItemIds: [],
};

/**
 * SPEC F10 — client-side, offline, over `searchBlob`.
 *
 * All tokens must match, in any order, as substrings. Substring rather than
 * prefix because a resident searching "melati" for a ward or "3b" for a bed
 * is matching mid-string, and requiring word starts would silently return
 * nothing.
 */
export function matchesQuery(patient: Patient, query: string): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  // The preview is included because a patient with no typed name is titled by
  // their note — searching for the words on the card must find the card.
  const dpjp = patient.dpjpId ? dpjpById(patient.dpjpId) : undefined;

  const haystack = [
    patient.searchBlob,
    patient.name ?? '',
    patient.preview ?? '',
    // Searchable by consultant, by full name or by initials: "AHN" and
    // "nashar" both find his patients.
    dpjp ? `${dpjp.name} ${dpjp.initials} ${dpjp.match.join(' ')}` : '',
  ]
    .join(' ')
    .toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

export function filterPatients(
  patients: readonly Patient[],
  filters: BoardFilters,
  items: readonly ChecklistItemDef[],
  today: ClinicalDate,
): Patient[] {
  return patients.filter((patient) => {
    if (!matchesQuery(patient, filters.query)) return false;
    if (filters.wards.length > 0 && !filters.wards.includes(patient.ward ?? '')) return false;
    if (
      filters.labels.length > 0 &&
      !filters.labels.some((label) => patient.labels.includes(label))
    ) {
      return false;
    }
    if (filters.pendingItemIds.length > 0) {
      const states = boardTickStates(patient, items, today);
      const allPending = filters.pendingItemIds.every((itemId) => !states[itemId]?.done);
      if (!allPending) return false;
    }
    return true;
  });
}

/**
 * Pinned first, then most recently updated.
 *
 * The Firestore query already orders this way, but the offline cache can serve
 * a partially-reconciled set, so the client sorts again rather than trusting
 * arrival order.
 */
/**
 * Pinned first, otherwise the query's own order (newest note first).
 *
 * This used to re-sort by `updatedAt`, which meant every keystroke moved the
 * card being typed into to the top of the board and pushed everything else
 * down. On a round that is unusable: you look away, look back, and the card
 * you were reading is somewhere else. Position is now stable for the whole
 * session — only pinning moves anything.
 */
export function sortPatients(patients: readonly Patient[]): Patient[] {
  const pinned = patients.filter((patient) => patient.pinned);
  const rest = patients.filter((patient) => !patient.pinned);
  return [...pinned, ...rest];
}

/** Distinct ward values present on the board, for the filter chips. */
export function availableWards(patients: readonly Patient[]): string[] {
  return [...new Set(patients.map((patient) => patient.ward).filter(Boolean))].sort() as string[];
}

export function availableLabels(patients: readonly Patient[]): string[] {
  return [...new Set(patients.flatMap((patient) => patient.labels))].sort();
}

export function hasActiveFilters(filters: BoardFilters): boolean {
  return (
    filters.query.trim().length > 0 ||
    filters.wards.length > 0 ||
    filters.labels.length > 0 ||
    filters.pendingItemIds.length > 0
  );
}

/**
 * Sort by physical location, the way the denah is laid out.
 *
 * Rounds walk the ward in room order, so a board in that order is a board you
 * can work down without hunting. This is the same information the denah
 * encodes — ward, then room, then bed — read from the fields already parsed out
 * of each note.
 *
 * Room and bed are compared NUMERICALLY where they look like numbers. A string
 * sort puts 410 between 41 and 42, and orders 1, 10, 2 — which on a ward with
 * rooms 401–421 is worse than no sorting at all, because it looks deliberate.
 * Anything non-numeric (`VIP`, `Super VIP`) falls back to a text compare and
 * sorts after the numbered rooms.
 */
function locationKey(value: string | undefined): [number, string] {
  const text = (value ?? '').trim();
  if (!text) return [Number.MAX_SAFE_INTEGER, ''];

  const digits = /^(\d+)/.exec(text);
  return digits?.[1]
    ? [Number(digits[1]), text.toLowerCase()]
    : [Number.MAX_SAFE_INTEGER - 1, text.toLowerCase()];
}

function compareLocation(a: Patient, b: Patient): number {
  // Ward first, alphabetically: a ward is a place you walk to, not a number.
  const wardDiff = (a.ward ?? '').localeCompare(b.ward ?? '', 'id');
  if (wardDiff !== 0) return wardDiff;

  const [aRoom, aRoomText] = locationKey(a.room);
  const [bRoom, bRoomText] = locationKey(b.room);
  if (aRoom !== bRoom) return aRoom - bRoom;
  if (aRoomText !== bRoomText) return aRoomText.localeCompare(bRoomText, 'id');

  const [aBed, aBedText] = locationKey(a.bed);
  const [bBed, bBedText] = locationKey(b.bed);
  if (aBed !== bBed) return aBed - bBed;
  return aBedText.localeCompare(bBedText, 'id');
}

export type BoardOrder = 'recent' | 'location' | 'dpjp';

/**
 * Patients with no location sort last, together.
 *
 * They are the ones just created and not yet filled in, and burying them among
 * the located patients means the card you are about to write in is somewhere
 * unpredictable. At the end they are exactly where you left them.
 */
export function orderPatients(patients: readonly Patient[], order: BoardOrder): Patient[] {
  const pinned = patients.filter((patient) => patient.pinned);
  const rest = patients.filter((patient) => !patient.pinned);

  if (order === 'recent') return [...pinned, ...rest];

  const sorted = [...rest].sort((a, b) => {
    if (order === 'dpjp') {
      // Unassigned last, then by initials, then by location within a consultant
      // — a DPJP's list is still walked in room order.
      const aDpjp = a.dpjpId ? (dpjpById(a.dpjpId)?.initials ?? '') : '';
      const bDpjp = b.dpjpId ? (dpjpById(b.dpjpId)?.initials ?? '') : '';
      if (aDpjp !== bDpjp) {
        if (!aDpjp) return 1;
        if (!bDpjp) return -1;
        return aDpjp.localeCompare(bDpjp, 'id');
      }
      return compareLocation(a, b);
    }

    const aHas = Boolean(a.ward?.trim() || a.room?.trim() || a.bed?.trim());
    const bHas = Boolean(b.ward?.trim() || b.room?.trim() || b.bed?.trim());
    if (aHas !== bHas) return aHas ? -1 : 1;

    return compareLocation(a, b);
  });

  return [...pinned, ...sorted];
}

/** Heading a card belongs under, for the grouped board. */
export function groupLabel(patient: Patient, order: BoardOrder): string {
  if (order === 'location') {
    const ward = patient.ward?.trim();
    const room = patient.room?.trim();
    if (!ward && !room) return 'Tanpa lokasi';
    return [ward, room ? `Kamar ${room}` : null].filter(Boolean).join(' · ');
  }

  if (order === 'dpjp') {
    const dpjp = patient.dpjpId ? dpjpById(patient.dpjpId) : undefined;
    return dpjp ? `${dpjp.initials} — ${dpjp.name}` : 'Tanpa DPJP';
  }

  return '';
}
