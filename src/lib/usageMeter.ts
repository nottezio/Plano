/**
 * This device's running count of Firestore reads, writes and errors, per day.
 *
 * Counted here, reported by `AccessGate` with the six-hourly stats, shown in
 * the admin's Kuota tab. See `domain/usage.ts` for what is counted and why it
 * is only an estimate.
 *
 * Kept in localStorage for the last seven days so a reload does not zero the
 * day. Saved at most every few seconds and when the page is hidden: a busy
 * listener must not turn into a storage write per snapshot. If storage is
 * unavailable the count lives in memory and simply restarts next visit.
 *
 * The counts belong to whoever is signed in on this device. When a different
 * account signs in they start over, so one person's reads are never reported
 * under another's name.
 */

import { WEEK_DAYS, buildReport, dayKey, lastDays, type DayCounts, type DeviceUsage } from '@/domain/usage';

const KEY = 'plano.usage';
const SAVE_DELAY_MS = 3000;
/** Label cardinality cap: anything past it is counted under `lain`. */
const MAX_LABELS = 30;
const MAX_LABEL_LENGTH = 40;

interface Store {
  owner: string | null;
  days: Record<string, DayCounts>;
}

let store: Store | undefined;
let saveTimer: number | undefined;
let listening = false;

const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0);

function cleanDay(value: unknown): DayCounts | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const by: Record<string, number> = {};
  if (raw['by'] && typeof raw['by'] === 'object') {
    for (const [label, count] of Object.entries(raw['by'] as Record<string, unknown>)) {
      if (num(count) > 0) by[label] = num(count);
    }
  }
  return { reads: num(raw['reads']), writes: num(raw['writes']), errors: num(raw['errors']), by };
}

function load(): Store {
  if (store) return store;
  store = { owner: null, days: {} };
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (parsed && typeof parsed === 'object') {
      const raw = parsed as Record<string, unknown>;
      if (typeof raw['owner'] === 'string') store.owner = raw['owner'];
      if (raw['days'] && typeof raw['days'] === 'object') {
        for (const [day, counts] of Object.entries(raw['days'] as Record<string, unknown>)) {
          const clean = cleanDay(counts);
          if (clean) store.days[day] = clean;
        }
      }
    }
  } catch {
    // No storage or unreadable: start from zero.
  }
  return store;
}

function flush(): void {
  saveTimer = undefined;
  try {
    localStorage.setItem(KEY, JSON.stringify(load()));
  } catch {
    // Storage full or blocked: the count stays in memory. Harmless.
  }
}

function schedule(): void {
  if (typeof window === 'undefined') return;
  if (!listening) {
    listening = true;
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }
  saveTimer ??= window.setTimeout(flush, SAVE_DELAY_MS);
}

function today(now: number = Date.now()): DayCounts {
  const state = load();
  const key = dayKey(now);
  let day = state.days[key];
  if (!day) {
    day = { reads: 0, writes: 0, errors: 0, by: {} };
    state.days[key] = day;
    const keep = new Set(lastDays(now, WEEK_DAYS));
    for (const existing of Object.keys(state.days)) {
      if (!keep.has(existing)) delete state.days[existing];
    }
  }
  return day;
}

/** `count` documents billed, from `label` (a collection shape such as `patients/entries`). */
export function recordReads(label: string, count: number): void {
  if (!(count > 0)) return;
  const day = today();
  day.reads += count;
  let name = label.slice(0, MAX_LABEL_LENGTH);
  if (!(name in day.by) && Object.keys(day.by).length >= MAX_LABELS) name = 'lain';
  day.by[name] = (day.by[name] ?? 0) + count;
  schedule();
}

/** One write call (a batch counts as one). */
export function recordWrite(): void {
  today().writes += 1;
  schedule();
}

/** One error worth the admin's attention (an uncaught error or a rejected write). */
export function recordError(): void {
  today().errors += 1;
  schedule();
}

/** Called when the signed-in account is known. A different account starts from zero. */
export function meterSetOwner(uid: string): void {
  const state = load();
  if (state.owner === uid) return;
  if (state.owner !== null) state.days = {};
  state.owner = uid;
  schedule();
}

/** What this device reports for itself right now. */
export function buildUsageReport(now: number = Date.now()): DeviceUsage {
  return buildReport(load().days, now);
}
