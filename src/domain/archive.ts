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
function localDay(date: Date): ClinicalDate {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function archiveDate(patient: Patient): ClinicalDate {
  const millis = patient.archive?.at?.toMillis?.();
  // The device's LOCAL calendar day. `toISOString()` is UTC, which filed
  // everything archived between 00:00 and 07:59 WITA under the previous day,
  // and on the 1st under the previous month.
  if (millis !== undefined) return localDay(new Date(millis));
  return patient.lastEntryDate ?? patient.admittedAt;
}

export interface WeekGroup {
  /** "2026-10-w2" */
  key: string;
  /** "Minggu 2 · 5–11 Okt" */
  label: string;
  patients: Patient[];
}

export interface MonthGroup {
  /** "2026-08" */
  key: string;
  /** "Agustus 2026" */
  label: string;
  patients: Patient[];
  /**
   * The month split into weeks (Monday–Sunday, clipped to the month), newest
   * first, only weeks that hold someone. A month of 60 discharges is a long
   * scroll; "which week did they go home" is how they are remembered.
   */
  weeks: WeekGroup[];
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Week of the month (1-based, Monday start) and its day range, clipped to the month. */
export function weekOfMonth(day: ClinicalDate): { index: number; from: number; to: number } {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // Monday = 0 … Sunday = 6
  const offset = (first.getUTCDay() + 6) % 7;
  const index = Math.floor((d - 1 + offset) / 7) + 1;
  const from = Math.max(1, (index - 1) * 7 - offset + 1);
  const to = Math.min(lastDay, index * 7 - offset);
  return { index, from, to };
}

function groupByWeek(monthKey: string, patients: readonly Patient[]): WeekGroup[] {
  const month = MONTH_SHORT[Number(monthKey.slice(5, 7)) - 1] ?? '';
  const weeks = new Map<number, { label: string; patients: Patient[] }>();
  for (const patient of patients) {
    const week = weekOfMonth(archiveDate(patient));
    const range = week.from === week.to ? `${week.from}` : `${week.from}–${week.to}`;
    const bucket = weeks.get(week.index);
    if (bucket) bucket.patients.push(patient);
    else weeks.set(week.index, { label: `Minggu ${week.index} · ${range} ${month}`, patients: [patient] });
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => b - a)
    .map(([index, week]) => ({ key: `${monthKey}-w${index}`, label: week.label, patients: week.patients }));
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
    .map(([key, list]) => {
      const patients = [...list].sort((a, b) => (archiveDate(a) < archiveDate(b) ? 1 : -1));
      return { key, label: monthLabel(key), patients, weeks: groupByWeek(key, patients) };
    });
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

/**
 * Which months and weeks of the archive are open (2026-10-02).
 *
 * A year of discharges is hundreds of rows; a month header you can fold is
 * how you get from "Agustus" to "Maret" without scrolling through everything
 * between. Only what the user chose is stored, per device — `true` open,
 * `false` closed — so the defaults keep applying to months that did not exist
 * yet when the choice was made:
 *
 *  - the newest month is open, older months are closed;
 *  - a week is open unless it was closed.
 *
 * While searching or filtering everything is open (`narrowing`): a match
 * hidden inside a folded month would read as "not found".
 */
export type ArchiveFolds = Readonly<Record<string, boolean>>;

export function isMonthOpen(folds: ArchiveFolds, key: string, position: number, narrowing: boolean): boolean {
  if (narrowing) return true;
  return folds[key] ?? position === 0;
}

export function isWeekOpen(folds: ArchiveFolds, key: string, narrowing: boolean): boolean {
  if (narrowing) return true;
  return folds[key] ?? true;
}

/** Open or close every month (and, opening, every week in them). */
export function setAllFolds(groups: readonly MonthGroup[], open: boolean): ArchiveFolds {
  const next: Record<string, boolean> = {};
  for (const group of groups) {
    next[group.key] = open;
    if (open) for (const week of group.weeks) next[week.key] = true;
  }
  return next;
}
