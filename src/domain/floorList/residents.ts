import { holderLabel } from './floor';
import type { FloorPatient } from './report';

export interface ResidentGroups {
  /** Chief → number of patients (division patients not counted). */
  chiefs: Array<[string, number]>;
  /** Junior → patients, in route order; "(belum diisi)" for none. */
  juniors: Array<[string, FloorPatient[]]>;
  /** "Divisi Aritmia" → patients held by that division (13.9): listed, not counted. */
  divisions: Array<[string, FloorPatient[]]>;
  /** Followed up, but no junior written yet. */
  unassigned: FloorPatient[];
  /**
   * Tagged "tidak di-follow up" (9 Nov 2026, Avi: titipan, chosen DPJPs):
   * listed, counted for nobody. Its own field so it can go last (19 Oct 2026).
   */
  unheld: FloorPatient[];
}

/** Renamed from "Tidak ada yang pegang" (19 Oct 2026, Avi). Since 9 Nov 2026: tagged patients only. */
export const NO_JUNIOR = 'Tidak di-FU';
/** A followed-up patient with no junior yet (before 9 Nov 2026 these sat in "Tidak di-FU"). */
export const NO_JUNIOR_YET = 'Belum ada junior';

export interface HolderBox {
  name: string;
  list: FloorPatient[];
  /** A cardiology division's patients: listed, counted for nobody. */
  division: boolean;
}

/**
 * The holder boxes in their one order, for the app, the Word file and the
 * PDF alike: juniors, then divisions, then "Tidak di-FU" LAST (19 Oct 2026,
 * Avi). Before, the unheld box sat wherever its first patient fell in the
 * route order, often between two juniors.
 */
export function holderBoxes(groups: ResidentGroups): HolderBox[] {
  return [
    ...groups.juniors.map(([name, list]) => ({ name, list, division: false })),
    ...groups.divisions.map(([name, list]) => ({ name, list, division: true })),
    ...(groups.unassigned.length > 0 ? [{ name: NO_JUNIOR_YET, list: groups.unassigned, division: false }] : []),
    ...(groups.unheld.length > 0 ? [{ name: NO_JUNIOR, list: groups.unheld, division: false }] : []),
  ];
}

/**
 * Who holds which patient, for the Residen section and the Word residents
 * page. A patient held by a cardiology division (a consult from another
 * department to e.g. Aritmia) is not the ward residents' patient: it goes to
 * its own block and counts for no junior or chief — before 13.9 it showed as
 * "(belum diisi)" and inflated the chief's count.
 */
export function residentGroups(sorted: readonly FloorPatient[]): ResidentGroups {
  const chiefs = new Map<string, number>();
  const juniors = new Map<string, FloorPatient[]>();
  const divisions = new Map<string, FloorPatient[]>();
  const unassigned: FloorPatient[] = [];
  const unheld: FloorPatient[] = [];
  for (const p of sorted) {
    if (p.division) {
      const key = holderLabel(p.division);
      divisions.set(key, [...(divisions.get(key) ?? []), p]);
      continue;
    }
    // Not followed up: like a division patient, nobody's count.
    if (p.tags?.some((t) => t.noFollowUp)) {
      unheld.push(p);
      continue;
    }
    if (p.chief) chiefs.set(p.chief, (chiefs.get(p.chief) ?? 0) + 1);
    if (!p.junior) {
      unassigned.push(p);
      continue;
    }
    juniors.set(p.junior, [...(juniors.get(p.junior) ?? []), p]);
  }
  return { chiefs: [...chiefs], juniors: [...juniors], divisions: [...divisions], unassigned, unheld };
}
