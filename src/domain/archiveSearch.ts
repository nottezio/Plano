import { ARCHIVE_REASON_LABELS, archiveDate, monthLabel } from './archive';
import { patientHaystack } from './board';
import { canonicalWard } from './denahPlan';
import { dpjpById } from './dpjp';
import type { ArchiveReason, Patient } from './types';

/**
 * Searching and filtering the archive.
 *
 * Shared by the board's search (which shows archived matches under active
 * ones) and the Arsip page, so both find the same patients for the same
 * words.
 *
 * NOTE TEXT is optional. A patient's own fields (name, RM, bed, ward,
 * diagnoses, card preview, DPJP) are always searched. The SOAP of every day
 * and the Catatan pasien are searched only when the caller passes them in:
 * the bodies live in a subcollection and are loaded on request (see
 * `useArchiveText`), so the default search stays instant and offline.
 */

export interface ArchiveFilters {
  dpjp: string | null;
  ward: string | null;
  reason: ArchiveReason | null;
  /** `YYYY-MM`. */
  month: string | null;
}

export const NO_ARCHIVE_FILTERS: ArchiveFilters = {
  dpjp: null,
  ward: null,
  reason: null,
  month: null,
};

export function hasArchiveFilters(filters: ArchiveFilters): boolean {
  return Object.values(filters).some((value) => value !== null);
}

export function searchTokens(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export function matchesArchiveFilters(patient: Patient, filters: ArchiveFilters): boolean {
  if (filters.dpjp !== null && (patient.dpjpId ?? '') !== filters.dpjp) return false;
  if (filters.ward !== null && canonicalWard(patient.ward ?? '') !== filters.ward) return false;
  if (filters.reason !== null && patient.archive?.reason !== filters.reason) return false;
  if (filters.month !== null && archiveDate(patient).slice(0, 7) !== filters.month) return false;
  return true;
}

export interface ArchiveMatch {
  patient: Patient;
  /**
   * Where in the notes the words were found, when the patient matched BECAUSE
   * of their notes. Null when the fields alone matched: a snippet then would
   * answer a question nobody asked.
   */
  snippet: string | null;
}

/**
 * Does this patient match every word?
 *
 * Every token must appear somewhere across fields + note text, in any order,
 * so "furosemid 40" finds a patient whose plan says both.
 */
export function matchArchived(
  patient: Patient,
  tokens: readonly string[],
  noteText?: string,
): ArchiveMatch | null {
  if (tokens.length === 0) return { patient, snippet: null };
  const fields = patientHaystack(patient);
  const notes = (noteText ?? '').toLowerCase();
  const fromNotes = tokens.filter((token) => !fields.includes(token));
  if (!fromNotes.every((token) => notes.includes(token))) return null;
  return {
    patient,
    snippet: fromNotes.length > 0 ? findSnippet(noteText ?? '', fromNotes) : null,
  };
}

/**
 * About `radius` characters either side of the first word found, on one line,
 * with ellipses where it was cut. Whitespace collapsed so a SOAP's line breaks
 * do not spread a snippet over a row.
 */
export function findSnippet(text: string, tokens: readonly string[], radius = 45): string | null {
  const lower = text.toLowerCase();
  let at = -1;
  let length = 0;
  for (const token of tokens) {
    const index = lower.indexOf(token);
    if (index !== -1 && (at === -1 || index < at)) {
      at = index;
      length = token.length;
    }
  }
  if (at === -1) return null;
  let start = Math.max(0, at - radius);
  let end = Math.min(text.length, at + length + radius);
  // Whole words at both cuts: `…on S: sesak` reads as a typo.
  if (start > 0) {
    const space = text.slice(start, at).search(/\s/);
    if (space !== -1) start += space + 1;
  }
  if (end < text.length) {
    const tail = text.slice(at + length, end);
    const space = Math.max(tail.lastIndexOf(' '), tail.lastIndexOf('\n'));
    if (space !== -1) end = at + length + space;
  }
  const body = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${body}${end < text.length ? '…' : ''}`;
}

export interface Facet<T extends string> {
  value: T;
  label: string;
  count: number;
}

export interface ArchiveFacets {
  dpjps: Facet<string>[];
  wards: Facet<string>[];
  reasons: Facet<ArchiveReason>[];
  months: Facet<string>[];
}

/**
 * The choices each filter offers, with counts, from the patients themselves.
 * Only values that occur are offered: a filter that can return nothing is a
 * control that teaches the user filters are broken.
 */
export function archiveFacets(patients: readonly Patient[]): ArchiveFacets {
  const dpjps = new Map<string, Facet<string>>();
  const wards = new Map<string, Facet<string>>();
  const reasons = new Map<ArchiveReason, Facet<ArchiveReason>>();
  const months = new Map<string, Facet<string>>();

  const bump = <T extends string>(map: Map<T, Facet<T>>, value: T, label: string): void => {
    const current = map.get(value);
    if (current) current.count += 1;
    else map.set(value, { value, label, count: 1 });
  };

  for (const patient of patients) {
    const dpjp = patient.dpjpId ? dpjpById(patient.dpjpId) : undefined;
    if (dpjp) bump(dpjps, dpjp.id, dpjp.initials);
    const ward = patient.ward?.trim() ? canonicalWard(patient.ward) : '';
    if (ward) bump(wards, ward, ward);
    const reason = patient.archive?.reason;
    if (reason) bump(reasons, reason, ARCHIVE_REASON_LABELS[reason]);
    const month = archiveDate(patient).slice(0, 7);
    bump(months, month, monthLabel(month));
  }

  const byCount = <T extends string>(list: Iterable<Facet<T>>): Facet<T>[] =>
    [...list].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    dpjps: byCount(dpjps.values()),
    wards: byCount(wards.values()),
    reasons: byCount(reasons.values()),
    // Months newest first: it is a timeline, not a popularity contest.
    months: [...months.values()].sort((a, b) => (a.value < b.value ? 1 : -1)),
  };
}
