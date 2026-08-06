import { checklistProgress, resolveCardColor, type ChecklistStates } from './checklist';
import { hariRawat } from './clinicalDate';
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

export function cardTitle(patient: Patient, showInitialsOnly: boolean): string {
  const label = showInitialsOnly ? initials(patient.name) : patient.name;
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
    preview: patient.preview ?? '',
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
  const haystack = patient.searchBlob || patient.name.toLowerCase();
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
export function sortPatients(patients: readonly Patient[]): Patient[] {
  return [...patients].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const aTime = a.updatedAt?.toMillis?.() ?? 0;
    const bTime = b.updatedAt?.toMillis?.() ?? 0;
    return bTime - aTime;
  });
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
