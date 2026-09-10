import { dpjpById } from './dpjp';
import { canonicalWard } from './denahPlan';
import type { Patient } from './types';

/**
 * Grouping patients into rooms, the way the denah lays them out.
 *
 * A ward is read as rooms, not as a list — you walk to a room and see who is in
 * it. The list view answers "who do I have"; this answers "what is in 418",
 * which is the question standing in the corridor.
 *
 * Rooms are ordered numerically and beds within them likewise, for the same
 * reason as the list sort: 410 between 41 and 42 looks deliberate and is wrong.
 */

export interface DenahBed {
  bed: string;
  patient: Patient;
}

export interface DenahRoom {
  /** Room number as written, e.g. `418`, `VIP`. */
  room: string;
  ward: string;
  beds: DenahBed[];
}

export interface DenahWard {
  ward: string;
  rooms: DenahRoom[];
}

function numericKey(value: string): number {
  const digits = /^(\d+)/.exec(value.trim());
  // Non-numeric rooms (VIP, Super VIP) sort after the numbered ones, together.
  return digits?.[1] ? Number(digits[1]) : Number.MAX_SAFE_INTEGER;
}

export const UNPLACED = 'Tanpa lokasi';

export function buildDenah(patients: readonly Patient[]): DenahWard[] {
  const wards = new Map<string, Map<string, DenahBed[]>>();

  for (const patient of patients) {
    /**
     * Grouped by the CANONICAL ward name, not the string as typed.
     *
     * `PJT Lt. 4`, `PJT Lantai 4`, `PJT LT. 4` and `PJT Lt 4` are one floor
     * written four ways, and every one of them appears in real records.
     * Keying on the raw text split them into separate denah blocks, each
     * rendering its own copy of the same floor plan with a few patients in it
     * — so a bed that was occupied looked empty on the block you happened to
     * be reading.
     *
     * `canonicalWard` is the same normalisation `wardPlan` already used to
     * match a plan; it just was not applied to the grouping, so the two
     * disagreed about how many wards existed.
     */
    const ward = canonicalWard(patient.ward ?? '') || UNPLACED;
    // A patient with a ward but no room still belongs somewhere visible: an
    // unnumbered room in that ward, rather than dropped from the floor plan.
    const room = patient.room?.trim() || (ward === UNPLACED ? UNPLACED : '—');

    const rooms = wards.get(ward) ?? new Map<string, DenahBed[]>();
    const beds = rooms.get(room) ?? [];
    beds.push({ bed: patient.bed?.trim() ?? '', patient });
    rooms.set(room, beds);
    wards.set(ward, rooms);
  }

  return [...wards.entries()]
    .sort(([a], [b]) => {
      // Unplaced last, wherever it falls alphabetically.
      if (a === UNPLACED) return 1;
      if (b === UNPLACED) return -1;
      return a.localeCompare(b, 'id');
    })
    .map(([ward, rooms]) => ({
      ward,
      rooms: [...rooms.entries()]
        .sort(([a], [b]) => numericKey(a) - numericKey(b) || a.localeCompare(b, 'id'))
        .map(([room, beds]) => ({
          ward,
          room,
          beds: [...beds].sort(
            (a, b) => numericKey(a.bed) - numericKey(b.bed) || a.bed.localeCompare(b.bed, 'id'),
          ),
        })),
    }));
}

/**
 * One line per bed, in the denah's own shorthand: `AFM/Tn. Roni/66 tahun/RM …`.
 *
 * Built from what the patient record already holds rather than re-parsed from
 * the note, so a card and its denah entry can never disagree.
 */
export function denahLine(patient: Patient, showInitialsOnly: boolean): string {
  const dpjp = patient.dpjpId ? dpjpById(patient.dpjpId) : undefined;
  const name = patient.name?.trim() || 'Tanpa nama';

  return [
    dpjp?.initials,
    showInitialsOnly ? initialsOnly(name) : name,
    patient.age !== undefined ? `${patient.age} th` : null,
    patient.mrn ? `RM ${patient.mrn}` : null,
  ]
    .filter(Boolean)
    .join(' / ');
}

function initialsOnly(name: string): string {
  return (
    name
      .replace(/\b(Tn|Ny|Nn|An|Sdr|Sdri)\.?\s*/gi, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('.') || '—'
  );
}

/**
 * Patients placed into a transcribed floor plan.
 *
 * Keyed by room, then by bed NUMBER rather than by array position: the sheet
 * numbers its slots, `patient.bed` holds that number, and matching them by
 * order would put the first patient recorded into bed 1 regardless of what the
 * record says. On a floor plan that is not a cosmetic error — it sends someone
 * to the wrong bed.
 */
export interface PlacedRoom {
  room: string;
  subtitle: string | undefined;
  /** One entry per numbered slot; `null` where the bed is empty. */
  beds: Array<Patient | null>;
  /**
   * In this room, but not in a numbered slot — no bed recorded, or a bed
   * number the sheet does not have.
   *
   * Shown rather than dropped. A patient the plan cannot place is exactly the
   * patient somebody needs to notice, and silently omitting them would make the
   * floor plan quietly wrong instead of visibly incomplete.
   */
  extra: Patient[];
}

export function placeInPlan(
  patients: readonly Patient[],
  rooms: readonly { room: string; subtitle?: string; beds: number }[],
): { rooms: PlacedRoom[]; strays: Patient[] } {
  const byRoom = new Map<string, Patient[]>();
  for (const patient of patients) {
    const room = patient.room?.trim() ?? '';
    const list = byRoom.get(room) ?? [];
    list.push(patient);
    byRoom.set(room, list);
  }

  const placed = rooms.map<PlacedRoom>((slot) => {
    const here = byRoom.get(slot.room) ?? [];
    byRoom.delete(slot.room);

    const beds = Array.from<Patient | null>({ length: slot.beds }).fill(null);
    const extra: Patient[] = [];

    for (const patient of here) {
      const index = Number(patient.bed?.trim()) - 1;
      // Taken beds do not get overwritten: two patients recorded in one bed is
      // a data problem to surface, not one to resolve by discarding a patient.
      if (Number.isInteger(index) && index >= 0 && index < beds.length && !beds[index]) {
        beds[index] = patient;
      } else {
        extra.push(patient);
      }
    }

    return { room: slot.room, subtitle: slot.subtitle, beds, extra };
  });

  // Anything left is in a room this ward's sheet does not list.
  const strays = [...byRoom.values()].flat();
  return { rooms: placed, strays };
}
