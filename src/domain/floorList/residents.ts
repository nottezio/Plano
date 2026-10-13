import { holderLabel } from './floor';
import type { FloorPatient } from './report';

export interface ResidentGroups {
  /** Chief → number of patients (division patients not counted). */
  chiefs: Array<[string, number]>;
  /** Junior → patients, in route order; "(belum diisi)" for none. */
  juniors: Array<[string, FloorPatient[]]>;
  /** "Divisi Aritmia" → patients held by that division (13.9): listed, not counted. */
  divisions: Array<[string, FloorPatient[]]>;
}

export const NO_JUNIOR = '(belum diisi)';

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
  for (const p of sorted) {
    if (p.division) {
      const key = holderLabel(p.division);
      divisions.set(key, [...(divisions.get(key) ?? []), p]);
      continue;
    }
    if (p.chief) chiefs.set(p.chief, (chiefs.get(p.chief) ?? 0) + 1);
    const key = p.junior || NO_JUNIOR;
    juniors.set(key, [...(juniors.get(key) ?? []), p]);
  }
  return { chiefs: [...chiefs], juniors: [...juniors], divisions: [...divisions] };
}
