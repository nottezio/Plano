import type { DenahRoomSlot } from '@/domain/denahPlan';
import { soapStamp, type FloorPatient } from './report';

/**
 * Which patient lies in which numbered bed of a room (12.9), shared by the
 * on-screen denah and the Word denah so the two never disagree.
 *
 * Bed n → its patient. A single-bed room takes its patient whatever bed the
 * message wrote. A patient whose bed is unreadable or out of range goes to the
 * first free slot; any left over are `loose` (printed under the room, never
 * dropped).
 *
 * Two patients on one bed: the newer SOAP keeps it and the older one is
 * `loose`, never moved to another bed (29 Oct 2026, Avi: a new patient
 * replaces the old one, who went home or moved; nobody shifts to bed n+1).
 */
export function placeBeds(slot: DenahRoomSlot, patients: readonly FloorPatient[]): { beds: Array<FloorPatient | null>; loose: FloorPatient[] } {
  const beds: Array<FloorPatient | null> = Array.from({ length: Math.max(slot.beds, 1) }, () => null);
  const waiting: FloorPatient[] = [];
  const loose: FloorPatient[] = [];
  const newestFirst = [...patients].sort((a, b) => soapStamp(b).localeCompare(soapStamp(a)));
  for (const patient of newestFirst) {
    const n = slot.beds <= 1 ? 1 : Number(patient.bed);
    if (!Number.isInteger(n) || n < 1 || n > beds.length) waiting.push(patient);
    else if (beds[n - 1] === null) beds[n - 1] = patient;
    else loose.push(patient);
  }
  // Free slots fill in the list's own order, as before.
  for (const patient of patients.filter((p) => waiting.includes(p))) {
    const free = beds.indexOf(null);
    if (free === -1) loose.push(patient);
    else beds[free] = patient;
  }
  return { beds, loose };
}
