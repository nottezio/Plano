import type { FloorPatient } from './report';

/**
 * Bagi pasien (10 Nov 2026, Avi): give the patients nobody on the floor holds
 * to the floor's residents, fairly, without touching anyone a floor resident
 * already follows.
 *
 * Who is given out: a patient the ward follows (not a division's, not tagged
 * "tidak di-follow up") whose junior is empty or not one of the floor
 * residents — the night resident who sent the SOAP and leaves tomorrow is in
 * "Bukan residen lantai ini", so their patients still need a holder.
 *
 * Fair by total load, counting what each resident already holds:
 *   1. MZ patients first, one each before anyone gets a second (every
 *      resident reports an MZ patient in the PowerPoint);
 *   2. Trio (AFM, AFG, ZD) next, so Trio counts stay even;
 *   3. the rest to whoever holds the fewest.
 * Ties go to the resident listed first, so the same list always gives the
 * same answer.
 */

export const TRIO_DPJP_IDS: readonly string[] = ['afm', 'afg', 'zd'];

export type AssignGroup = 'mz' | 'trio' | 'lain';

/** MZ as utama or as KJS (both go in his slides); Trio as utama. */
export function assignGroup(patient: Pick<FloorPatient, 'dpjpId' | 'kjsDpjpIds'>): AssignGroup {
  if (patient.dpjpId === 'mz' || patient.kjsDpjpIds.includes('mz')) return 'mz';
  if (patient.dpjpId && TRIO_DPJP_IDS.includes(patient.dpjpId)) return 'trio';
  return 'lain';
}

/** The floor resident this junior name is, or null. Names are already in roster spelling (`effective`). */
export function residentOf(junior: string, residents: readonly string[]): string | null {
  const key = junior.trim().toLowerCase();
  return key ? (residents.find((r) => r.trim().toLowerCase() === key) ?? null) : null;
}

export function needsHolder(patient: FloorPatient, residents: readonly string[]): boolean {
  if (patient.division) return false;
  if (patient.tags?.some((t) => t.noFollowUp)) return false;
  return residentOf(patient.junior, residents) === null;
}

export interface Load {
  total: number;
  mz: number;
  trio: number;
}

const empty = (): Load => ({ total: 0, mz: 0, trio: 0 });

function add(load: Load, group: AssignGroup): void {
  load.total += 1;
  if (group === 'mz') load.mz += 1;
  if (group === 'trio') load.trio += 1;
}

/** What each floor resident holds now: kept patients only. */
function keptLoads(patients: readonly FloorPatient[], residents: readonly string[]): Map<string, Load> {
  const loads = new Map(residents.map((r) => [r, empty()]));
  for (const p of patients) {
    if (p.division || p.tags?.some((t) => t.noFollowUp)) continue;
    const holder = residentOf(p.junior, residents);
    if (holder) add(loads.get(holder)!, assignGroup(p));
  }
  return loads;
}

const ORDER: Record<AssignGroup, number> = { mz: 0, trio: 1, lain: 2 };

/**
 * The proposal: each patient needing a holder → a floor resident.
 * `patients` in route order (the order ties fall in within a group).
 */
export function proposeAssignment(patients: readonly FloorPatient[], residents: readonly string[], skip: ReadonlySet<string> = new Set()): Map<string, string> {
  const out = new Map<string, string>();
  // `skip` (11 Nov 2026, Avi): residents left out of the share, e.g. the list maker; their own patients still count as held.
  const targets = residents.filter((r) => !skip.has(r));
  if (targets.length === 0) return out;
  const loads = keptLoads(patients, residents);
  const open = patients
    .map((p, i) => ({ p, i, group: assignGroup(p) }))
    .filter(({ p }) => needsHolder(p, residents))
    .sort((a, b) => ORDER[a.group] - ORDER[b.group] || a.i - b.i);
  for (const { p, group } of open) {
    const score = (name: string): number[] => {
      const l = loads.get(name)!;
      return group === 'mz' ? [l.mz, l.total] : group === 'trio' ? [l.trio, l.total] : [l.total];
    };
    let best = targets[0]!;
    for (const name of targets.slice(1)) {
      const [a, b] = [score(name), score(best)];
      const diff = a.findIndex((v, k) => v !== b[k]);
      if (diff >= 0 && a[diff]! < b[diff]!) best = name;
    }
    add(loads.get(best)!, group);
    out.set(p.key, best);
  }
  return out;
}

export interface ResidentLoad {
  name: string;
  before: Load;
  after: Load;
}

/** Before and after for each resident, with the choices as they stand (the proposal, changed by hand). */
export function loadsWith(patients: readonly FloorPatient[], residents: readonly string[], chosen: ReadonlyMap<string, string>): ResidentLoad[] {
  const before = keptLoads(patients, residents);
  const after = keptLoads(patients, residents);
  for (const p of patients) {
    const to = chosen.get(p.key);
    const load = to ? after.get(to) : undefined;
    if (load) add(load, assignGroup(p));
  }
  return residents.map((name) => ({ name, before: before.get(name)!, after: after.get(name)! }));
}
