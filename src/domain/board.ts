import { checklistProgress, resolveCardColor, type ChecklistStates } from './checklist';
import { hariRawat } from './clinicalDate';
import { displayName, redactName } from './identity';
import { dpjpById, type Dpjp } from './dpjp';
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
  patient: Patient;
  title: string;
  colorToken: string;
  hariRawat: number;
  progress: ReturnType<typeof checklistProgress>;
  /** Consultant detected from the note, for the card badge. */
  dpjp: Dpjp | null;
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
    dpjp: patient.dpjpId ? (dpjpById(patient.dpjpId) ?? null) : null,
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
