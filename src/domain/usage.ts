/**
 * Firestore usage, as each device ESTIMATES it (the Kuota tab).
 *
 * Firebase cannot say which account causes the reads: its console shows one
 * project-wide total. So every app counts what it reads and writes, and sends
 * the counts with its six-hourly report. Everything here is an estimate:
 * counted on the device, up to six hours old, and only from apps new enough to
 * report. It is never "measured".
 *
 * HOW A READ IS COUNTED (Firestore bills per document received from the server)
 *
 * - Anything answered from the local cache costs nothing.
 * - A listener's first server snapshot bills every document in it (at least 1).
 *   Later ones bill only the documents that changed.
 * - A one-off `getDocs` / `getDoc` from the server bills the documents returned.
 *
 * Known error: a listener that reattaches within 30 minutes resumes free in
 * Firestore but is counted again here, so the estimate leans high.
 */

import { toLocalIso } from './notice';

export const QUOTA_DAILY = 50_000;
export const QUOTA_WARN = 30_000;
export const QUOTA_DANGER = 40_000;

export type QuotaLevel = 'ok' | 'warn' | 'danger';

export const quotaLevel = (reads: number): QuotaLevel =>
  reads >= QUOTA_DANGER ? 'danger' : reads >= QUOTA_WARN ? 'warn' : 'ok';

export const TOP_SOURCES = 5;
export const WEEK_DAYS = 7;

export interface UsageSource {
  /** Collection shape, e.g. `patients/entries`. */
  l: string;
  r: number;
}

/** What one device reports for itself. */
export interface DeviceUsage {
  /** Local calendar day these counts are for (ISO). */
  day: string;
  reads: number;
  writes: number;
  errors: number;
  top: UsageSource[];
  /** Reads per local day, last seven days. */
  week: Record<string, number>;
}

/** What a device keeps for one day. */
export interface DayCounts {
  reads: number;
  writes: number;
  errors: number;
  by: Record<string, number>;
}

export interface SnapshotFacts {
  fromCache: boolean;
  /** A query/collection result (true) or one document (false). */
  isQuery: boolean;
  size: number;
  /** Documents added, changed or removed since the previous snapshot. */
  changes: number;
}

/** Reads one snapshot is estimated to bill. `first` = the listener's first server snapshot. */
export function readsFor(facts: SnapshotFacts, first: boolean): number {
  if (facts.fromCache) return 0;
  if (!facts.isQuery) return 1;
  return first ? Math.max(1, facts.size) : facts.changes;
}

export const dayKey = (now: number): string => toLocalIso(new Date(now));

/** Today first, then back `count - 1` days (local calendar). */
export function lastDays(now: number, count: number = WEEK_DAYS): string[] {
  const days: string[] = [];
  for (let back = 0; back < count; back += 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - back);
    days.push(toLocalIso(date));
  }
  return days;
}

/** The report a device sends: today's counts, its top sources, and its week. */
export function buildReport(days: Record<string, DayCounts>, now: number): DeviceUsage {
  const today = days[dayKey(now)];
  const top = Object.entries(today?.by ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_SOURCES)
    .map(([l, r]) => ({ l, r }));
  const week: Record<string, number> = {};
  for (const day of lastDays(now)) {
    const counts = days[day];
    if (counts) week[day] = counts.reads;
  }
  return {
    day: dayKey(now),
    reads: today?.reads ?? 0,
    writes: today?.writes ?? 0,
    errors: today?.errors ?? 0,
    top,
    week,
  };
}

export interface AccountUsage {
  readsToday: number;
  readsWeek: number;
  writesToday: number;
  errorsToday: number;
  /** Devices that reported within the week. */
  devices: number;
  top: UsageSource[];
}

/**
 * One account's usage across its devices. A device whose last report is from an
 * earlier day contributes nothing to "today": it may have read more since, but
 * has not said so.
 */
export function summarizeAccount(usage: Record<string, DeviceUsage>, now: number): AccountUsage {
  const today = dayKey(now);
  const days = lastDays(now);
  const sources = new Map<string, number>();
  const total: AccountUsage = { readsToday: 0, readsWeek: 0, writesToday: 0, errorsToday: 0, devices: 0, top: [] };

  for (const device of Object.values(usage)) {
    let recent = false;
    for (const day of days) {
      const reads = device.week[day];
      if (reads !== undefined) {
        total.readsWeek += reads;
        recent = true;
      }
    }
    if (device.day === today) {
      recent = true;
      total.readsToday += device.reads;
      total.writesToday += device.writes;
      total.errorsToday += device.errors;
      for (const source of device.top) sources.set(source.l, (sources.get(source.l) ?? 0) + source.r);
    }
    if (recent) total.devices += 1;
  }

  total.top = [...sources.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_SOURCES)
    .map(([l, r]) => ({ l, r }));
  return total;
}
