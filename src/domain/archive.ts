import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

import { toUtcInstant } from './clinicalDate';
import type { ArchiveReason, ClinicalDate, Patient } from './types';

/**
 * SPEC F9 — archive and trash.
 *
 * Archiving is a status change, not a deletion: an archived patient keeps every
 * entry, every checklist day and every revision, and stays fully copyable. A
 * discharge summary is often written *after* discharge, so anything that made
 * the record read-only or unreachable at archive time would break the workflow
 * it was meant to tidy up.
 */

export const ARCHIVE_REASON_LABELS: Record<ArchiveReason, string> = {
  pulang: 'Pulang',
  pindah: 'Pindah ruang/RS',
  meninggal: 'Meninggal',
  lainnya: 'Lainnya',
};

/**
 * The date an archived patient should be filed under.
 *
 * `archive.at` is a `serverTimestamp()`, so it is null on the device that just
 * archived while the write is still queued. Falling back to the last entry (and
 * then to admission) keeps the patient in a sensible month offline instead of
 * vanishing into an "unknown" bucket until reconnect.
 */
export function archiveDate(patient: Patient): ClinicalDate {
  const millis = patient.archive?.at?.toMillis?.();
  if (millis !== undefined) return new Date(millis).toISOString().slice(0, 10);
  return patient.lastEntryDate ?? patient.admittedAt;
}

export interface MonthGroup {
  /** "2026-08" */
  key: string;
  /** "Agustus 2026" */
  label: string;
  patients: Patient[];
}

export function groupByMonth(patients: readonly Patient[]): MonthGroup[] {
  const groups = new Map<string, Patient[]>();

  for (const patient of patients) {
    const key = archiveDate(patient).slice(0, 7);
    const bucket = groups.get(key);
    if (bucket) bucket.push(patient);
    else groups.set(key, [patient]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, list]) => ({
      key,
      label: monthLabel(key),
      patients: [...list].sort((a, b) =>
        archiveDate(a) < archiveDate(b) ? 1 : -1,
      ),
    }));
}

export function monthLabel(monthKey: string): string {
  const instant = toUtcInstant(`${monthKey}-01`);
  const local = new Date(instant.getTime() + instant.getTimezoneOffset() * 60_000);
  return format(local, 'MMMM yyyy', { locale: localeId });
}

export function archiveSummary(patient: Patient): string {
  const reason = patient.archive?.reason;
  const label = reason ? ARCHIVE_REASON_LABELS[reason] : 'Diarsipkan';
  const note = patient.archive?.note;
  return note ? `${label} — ${note}` : label;
}
