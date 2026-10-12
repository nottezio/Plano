import { addDays } from '@/domain/clinicalDate';
import type { ClinicalDate } from '@/domain/types';
import { KEEP_DAYS, pruneDays, type SensusAiResult, type SensusDay, type SensusList, type SensusStore } from './makerStore';

/**
 * Buat Sensus, synced (12.6). Pure half: what to write, and how a remote copy
 * folds into the local store. Firestore lives in `sensusInput.repo.ts`, the
 * timing in `useSensusInputSync`.
 *
 * WHY (Avi, 2026-10-12): the pasted lists, the AI result and the "Sudah saya
 * cek" ticks were device-only and cleared at sign-out, so signing out (or
 * switching phone) mid-census threw away the work. They now live in the
 * account, one document per tanggal sensus: `users/{uid}/sensusInput/{date}`.
 *
 * SHAPE OF A WRITE. Leaves, not the day (pattern 5): `ai.<CODE>`,
 * `extra.<CODE>`, `checked.<CODE>` are written one DPJP at a time, so a tick on
 * the phone and an AI run on the laptop for different DPJPs cannot overwrite
 * each other. `lists` is the exception and is written whole: it is the text of
 * the boxes, one editing surface, and splitting it would let a deleted box
 * survive as a merge of two arrays.
 */

/** Firestore's document cap is 1 MiB; leave room for keys and overhead. */
export const MAX_DAY_CHARS = 900_000;

type Leaves<T> = Record<string, T | null>;

/** `null` leaf = delete that field. */
export interface DayPatch {
  lists?: SensusList[];
  ai?: Leaves<SensusAiResult>;
  extra?: Leaves<string[]>;
  checked?: Leaves<string[]>;
}

/** Plain JSON: Firestore refuses `undefined`, and optional fields may hold it. */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function leafDiff<T>(prev: Readonly<Record<string, T>> = {}, next: Readonly<Record<string, T>> = {}): Leaves<T> | undefined {
  const out: Leaves<T> = {};
  for (const code of Object.keys(next)) {
    if (!same(prev[code], next[code])) out[code] = plain(next[code]!);
  }
  for (const code of Object.keys(prev)) {
    if (!(code in next)) out[code] = null;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** What changed from `prev` (what the account holds) to `next`; null = nothing. */
export function dayPatch(prev: SensusDay | undefined, next: SensusDay): DayPatch | null {
  const patch: DayPatch = {};
  if (!same(prev?.lists, next.lists)) patch.lists = plain(next.lists);
  const ai = leafDiff(prev?.ai, next.ai);
  if (ai) patch.ai = ai;
  const extra = leafDiff(prev?.extra, next.extra);
  if (extra) patch.extra = extra;
  const checked = leafDiff(prev?.checked, next.checked);
  if (checked) patch.checked = checked;
  return Object.keys(patch).length > 0 ? patch : null;
}

export function sameDay(a: SensusDay | undefined, b: SensusDay | undefined): boolean {
  return same(a, b);
}

/** Too large for one document: kept on the device only, and said so. */
export function tooBigToSync(day: SensusDay): boolean {
  return JSON.stringify(day).length > MAX_DAY_CHARS;
}

/**
 * The local store with the account's days folded in.
 *
 * - A date being edited here (`dirty`: a write is waiting) keeps the local
 *   copy; the write that follows carries it to the account.
 * - Otherwise the account wins: it is what every device last agreed on.
 * - A date the account HAD (`known`) and no longer has was removed elsewhere
 *   (emptied or pruned) and goes here too. A local date the account never had
 *   is kept: it is waiting to be uploaded, not deleted.
 */
export function mergeRemoteDays(
  store: SensusStore,
  remote: Readonly<Record<string, SensusDay>>,
  dirty: ReadonlySet<string>,
  known: ReadonlySet<string>,
  today: ClinicalDate,
): SensusStore {
  const days: Record<string, SensusDay> = { ...store.days };
  for (const [date, day] of Object.entries(remote)) {
    if (!dirty.has(date)) days[date] = day;
  }
  for (const date of Object.keys(store.days)) {
    if (!(date in remote) && known.has(date) && !dirty.has(date)) delete days[date];
  }
  const pruned = pruneDays(days, today);
  return same(pruned, store.days) ? store : { ...store, days: pruned };
}

/** Account dates older than the store keeps: deleted from the account. */
export function expiredDates(dates: Iterable<string>, today: ClinicalDate): string[] {
  const oldest = addDays(today, -KEEP_DAYS);
  return [...dates].filter((date) => date < oldest);
}
