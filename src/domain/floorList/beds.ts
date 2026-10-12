import type { DenahRoomSlot } from '@/domain/denahPlan';
import type { FloorPatient } from './report';

/**
 * Which patient lies in which numbered bed of a room (12.9), shared by the
 * on-screen denah and the Word denah so the two never disagree.
 *
 * Bed n → its patient. A single-bed room takes its patient whatever bed the
 * message wrote. A patient whose bed is unreadable, out of range or already
 * taken goes to the first free slot; any left over are `loose` (printed under
 * the room, never dropped).
 */
export function placeBeds(slot: DenahRoomSlot, patients: readonly FloorPatient[]): { beds: Array<FloorPatient | null>; loose: FloorPatient[] } {
  const beds: Array<FloorPatient | null> = Array.from({ length: Math.max(slot.beds, 1) }, () => null);
  const waiting: FloorPatient[] = [];
  for (const patient of patients) {
    const n = Number(patient.bed);
    if (slot.beds <= 1 && beds[0] === null) beds[0] = patient;
    else if (Number.isInteger(n) && n >= 1 && n <= beds.length && beds[n - 1] === null) beds[n - 1] = patient;
    else waiting.push(patient);
  }
  const loose: FloorPatient[] = [];
  for (const patient of waiting) {
    const free = beds.indexOf(null);
    if (free === -1) loose.push(patient);
    else beds[free] = patient;
  }
  return { beds, loose };
}
