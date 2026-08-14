import { dpjpById } from './dpjp';
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
    const ward = patient.ward?.trim() || UNPLACED;
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
