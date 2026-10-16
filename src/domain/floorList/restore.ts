import type { RosterPatient, StatusChange } from './floor';

/**
 * Restore points for the List Maker roster (2026-10-16, Avi: "save the state
 * of the list so the user can undo the changes if they import a WhatsApp
 * export and there are mistakes").
 *
 * Two kinds of point, for two kinds of undo:
 *
 * - `touched` — made just BEFORE a write that changes many patients at once
 *   (a Tempel save, a restore itself). It holds only the patients that write
 *   will change, as they were, plus the keys it will ADD. Undoing puts those
 *   patients back and erases the added ones; nobody else is touched, so an
 *   edit a colleague made to another patient in between survives.
 * - `active` — made with each saved edition (Simpan edisi): every patient on
 *   the floor at that moment. Restoring returns the floor to that list:
 *   patients changed since are put back, patients who came in later are
 *   erased, patients who left since come back.
 *
 * The plan is computed and SHOWN before anything is written (`planRestore`),
 * and the restore makes its own `touched` point first, so a restore is
 * undoable too. Pure: the repository stores and applies.
 */

export type RestoreKind = 'edisi' | 'tempel' | 'pulihkan';

export interface RestorePoint {
  id: string;
  kind: RestoreKind;
  /** What it is, for the list: "Sebelum tempel", "Edisi 16/10/2026 16.00". */
  label: string;
  /** ISO time it was made. */
  createdAt: string;
  createdBy: string;
  /** The edition it belongs to (kind `edisi`), else ''. */
  editionId: string;
  scope: 'touched' | 'active';
  /** Patients as they were. */
  patients: RosterPatient[];
  /** Keys that did not exist yet (scope `touched`): undoing erases them. */
  added: string[];
}

/** A point as listed: everything but the patients, which are read on demand. */
export type RestorePointMeta = Omit<RestorePoint, 'patients' | 'added'> & { count: number };

export interface RestorePlan {
  /** Put back as they were (changed since, left the floor, or erased). */
  revert: Array<{ patient: RosterPatient; why: 'changed' | 'back' | 'recreated' }>;
  /** Erased: came in after the point. */
  remove: RosterPatient[];
  /**
   * On the floor now, existed before the point, but not on the list then (a
   * patient who left and came back in between). Their earlier state is not
   * in an `active` point, so they are left as they are and named.
   */
  stuck: RosterPatient[];
  /** Already as they were. */
  same: number;
}

/** Two roster entries say the same thing (the change log aside: a restore appends to it). */
export function sameEntry(a: RosterPatient, b: RosterPatient): boolean {
  const { log: _a, ...left } = a;
  const { log: _b, ...right } = b;
  return JSON.stringify(left) === JSON.stringify(right);
}

export function planRestore(point: Pick<RestorePoint, 'scope' | 'patients' | 'added' | 'createdAt'>, current: readonly RosterPatient[]): RestorePlan {
  const now = new Map(current.map((p) => [p.key, p]));
  const kept = new Set(point.patients.map((p) => p.key));
  const revert: RestorePlan['revert'] = [];
  let same = 0;
  for (const before of point.patients) {
    const live = now.get(before.key);
    if (!live) revert.push({ patient: before, why: 'recreated' });
    else if (sameEntry(live, before)) same += 1;
    else revert.push({ patient: before, why: live.status !== 'dirawat' && before.status === 'dirawat' ? 'back' : 'changed' });
  }
  const remove: RosterPatient[] = [];
  const stuck: RosterPatient[] = [];
  if (point.scope === 'touched') {
    const added = new Set(point.added);
    for (const live of current) if (added.has(live.key) && !kept.has(live.key)) remove.push(live);
  } else {
    for (const live of current) {
      if (live.status !== 'dirawat' || kept.has(live.key)) continue;
      // Came in after the point: erased. ISO strings compare as times.
      if (!live.addedAt || live.addedAt > point.createdAt) remove.push(live);
      else stuck.push(live);
    }
  }
  return { revert, remove, stuck, same };
}

export const isEmptyPlan = (plan: RestorePlan): boolean => plan.revert.length === 0 && plan.remove.length === 0;

/**
 * The point to make before a write that changes `keys` and adds `added`:
 * those patients as they are now. A key both changed and new is just new.
 */
export function touchedPoint(
  roster: readonly RosterPatient[],
  keys: Iterable<string>,
  added: Iterable<string>,
  meta: Pick<RestorePoint, 'kind' | 'label' | 'createdAt' | 'createdBy'>,
): Omit<RestorePoint, 'id'> {
  const byKey = new Map(roster.map((p) => [p.key, p]));
  const fresh = [...new Set(added)].filter((key) => !byKey.has(key));
  const before = [...new Set(keys)].map((key) => byKey.get(key)).filter((p): p is RosterPatient => p !== undefined);
  return { ...meta, editionId: '', scope: 'touched', patients: before, added: fresh };
}

/** The point an edition keeps: every patient on the floor. */
export function editionPoint(
  roster: readonly RosterPatient[],
  meta: Pick<RestorePoint, 'label' | 'createdAt' | 'createdBy' | 'editionId'>,
): Omit<RestorePoint, 'id'> {
  return { ...meta, kind: 'edisi', scope: 'active', patients: roster.filter((p) => p.status === 'dirawat'), added: [] };
}

/** Before a restore: the patients it will write, as they are now — so the restore can be undone. */
export function pointBeforeRestore(
  plan: RestorePlan,
  current: readonly RosterPatient[],
  meta: Pick<RestorePoint, 'label' | 'createdAt' | 'createdBy'>,
): Omit<RestorePoint, 'id'> {
  const keys = [...plan.revert.map((r) => r.patient.key), ...plan.remove.map((p) => p.key)];
  const recreated = plan.revert.filter((r) => r.why === 'recreated').map((r) => r.patient.key);
  return touchedPoint(current, keys, recreated, { ...meta, kind: 'pulihkan' });
}

/** The patient as written back: its earlier state, with the restore added to its log. */
export function restored(patient: RosterPatient, log: StatusChange): RosterPatient {
  return { ...patient, log: [...patient.log, log] };
}

/** Stored as JSON text in parts (a full floor can pass Firestore's 1 MiB per document). */
export const PART_CHARS = 300_000;

export function toParts(point: Pick<RestorePoint, 'patients' | 'added'>): string[] {
  const text = JSON.stringify({ patients: point.patients, added: point.added });
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += PART_CHARS) parts.push(text.slice(i, i + PART_CHARS));
  return parts.length > 0 ? parts : ['{"patients":[],"added":[]}'];
}

/** Joined back; `read` normalises each patient as the roster reader does. */
export function fromParts(
  parts: readonly string[],
  read: (key: string, data: Record<string, unknown>) => RosterPatient | null,
): Pick<RestorePoint, 'patients' | 'added'> {
  try {
    const data = JSON.parse(parts.join('')) as { patients?: unknown; added?: unknown };
    const patients = (Array.isArray(data.patients) ? data.patients : [])
      .map((raw) => {
        const entry = raw as Record<string, unknown> | null;
        return entry && typeof entry.key === 'string' ? read(entry.key, entry) : null;
      })
      .filter((p): p is RosterPatient => p !== null);
    const added = Array.isArray(data.added) ? data.added.filter((k): k is string => typeof k === 'string') : [];
    return { patients, added };
  } catch {
    return { patients: [], added: [] };
  }
}

/** Points kept per list; older ones are pruned when a new one is made. */
export const KEEP_POINTS = 30;
