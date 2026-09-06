import { addDays } from '../clinicalDate';
import { DPJPS } from '../dpjp';
import type { ClinicalDate } from '../types';

/**
 * Outpatient clinic roster — JADWAL DPJP POLI CARDIO PJT, **Januari 2026**.
 *
 * Transcribed from the signed sheet. The month is carried in `SCHEDULE_PERIOD`
 * and shown wherever the schedule is, because a roster is a document with a
 * date on it: a resident reading "Rabu, poli 4" needs to know whether they are
 * reading this month's sheet or one from before someone rotated.
 *
 * Names are matched to the DPJP registry by id so the two cannot drift. Anyone
 * on the roster who is not in the registry — `M.Tasrif Mansur` — is kept as a
 * plain name rather than dropped, because the schedule is still correct about
 * them.
 */

export const SCHEDULE_PERIOD = 'Juli 2026';

/** 1 = Monday … 5 = Friday, matching `Date.getDay()`. */
export interface PoliSlot {
  weekday: 1 | 2 | 3 | 4 | 5;
  /** Registry id, or null when the consultant is not in it. */
  dpjpId: string | null;
  name: string;
  /** `1 (Cardio PJT)`, `Poli Konsul & Echo IRJ`. */
  clinic: string;
  time: string;
}

const DAY = '08.00 - 16.00';

export const POLI_SCHEDULE: readonly PoliSlot[] = [
  { weekday: 1, dpjpId: 'ks', name: 'Dr. dr. Khalid Saleh, Sp.PD-KKV', clinic: '1 (Cardio PJT)', time: DAY },
  { weekday: 1, dpjpId: null, name: 'dr. M.Tasrif Mansur, Sp.PD,KKV', clinic: '2 (Cardio PJT)', time: DAY },
  { weekday: 1, dpjpId: 'pt', name: 'dr. Pendrik Tandean Sp.PD-KKV', clinic: '4 (Cardio PJT)', time: DAY },
  { weekday: 1, dpjpId: 'maa', name: 'dr. Muhammad Asrul Apris, Sp.JP(K)', clinic: '5 (Cardio PJT)', time: DAY },
  { weekday: 1, dpjpId: 'zd', name: 'dr. Zaenab Djafar, Sp.PD, Sp.JP(K)', clinic: 'Poli Konsul & Echo IRJ', time: DAY },
  { weekday: 2, dpjpId: 'zd', name: 'dr. Zaenab Djafar, Sp.PD, Sp.JP(K)', clinic: '1 (Cardio PJT)', time: DAY },
  { weekday: 2, dpjpId: 'ahn', name: 'dr. Az Hafid Nashar, SpJP(K)', clinic: '2 (Cardio PJT)', time: DAY },
  { weekday: 2, dpjpId: 'pk', name: 'Prof. dr. Peter Kabo, Ph.D, Sp.FK, Sp.JP(K)', clinic: '4 (Cardio PJT)', time: '08.00 - 12.00' },
  { weekday: 2, dpjpId: 'np', name: 'dr. Nurminsyah Purnamawan, Sp.Jp (K)', clinic: '4 (Cardio PJT)', time: '13.00 - 16.00' },
  { weekday: 2, dpjpId: 'aha', name: 'Dr. dr. Abdul Hakim Alkatiri, Sp.JP(K)', clinic: '5 (Cardio PJT)', time: DAY },
  { weekday: 2, dpjpId: 'ks', name: 'Dr. dr. Khalid Saleh, Sp.PD-KKV', clinic: 'Poli Konsul & Echo IRJ', time: DAY },
  { weekday: 3, dpjpId: 'afm', name: 'Dr.dr. Akhtar Fajar Muzakkir, SpJP(K)', clinic: '1 (Cardio PJT)', time: DAY },
  { weekday: 3, dpjpId: 'afg', name: 'dr. Aussie Fitriani Ghaznawie, Sp.JP(K)', clinic: '2 (Cardio PJT)', time: DAY },
  { weekday: 3, dpjpId: 'np', name: 'dr. Nurminsyah Purnamawan, Sp.Jp (K)', clinic: '4 (Cardio PJT)', time: DAY },
  { weekday: 3, dpjpId: null, name: 'dr. M.Tasrif Mansur, Sp.PD,KKV', clinic: '5 (Cardio PJT)', time: DAY },
  { weekday: 3, dpjpId: 'pt', name: 'dr. Pendrik Tandean Sp.PD-KKV', clinic: 'Poli Konsul & Echo IRJ', time: DAY },
  { weekday: 4, dpjpId: 'afg', name: 'dr. Aussie Fitriani Ghaznawie, Sp.JP(K)', clinic: '1 (Cardio PJT)', time: DAY },
  { weekday: 4, dpjpId: 'pk', name: 'Prof. dr. Peter Kabo, Ph.D, Sp.FK, Sp.JP(K)', clinic: '2 (Cardio PJT)', time: DAY },
  { weekday: 4, dpjpId: 'pt', name: 'dr. Pendrik Tandean Sp.PD-KKV', clinic: '4 (Cardio PJT)', time: DAY },
  { weekday: 4, dpjpId: 'ks', name: 'Dr. dr. Khalid Saleh, Sp.PD-KKV', clinic: '5 (Cardio PJT)', time: DAY },
  { weekday: 4, dpjpId: null, name: 'dr. M.Tasrif Mansur, Sp.PD,KKV', clinic: 'Poli Konsul & Echo IRJ', time: DAY },
  { weekday: 5, dpjpId: 'zd', name: 'dr. Zaenab Djafar, Sp.PD, Sp.JP(K)', clinic: '1 (Cardio PJT)', time: '08.00 - 12.00' },
  { weekday: 5, dpjpId: 'im', name: 'Dr. dr. Idar Mappangara, Sp.PD, Sp.JP(K)', clinic: '1 (Cardio PJT)', time: '13.00 - 16.30' },
  { weekday: 5, dpjpId: 'ahn', name: 'dr. Az Hafid Nashar, SpJP(K)', clinic: '2 (Cardio PJT)', time: '08.00 - 16.30' },
  { weekday: 5, dpjpId: 'maa', name: 'dr. Muhammad Asrul Apris, Sp.JP(K)', clinic: '4 (Cardio PJT)', time: '08.00 - 16.30' },
  { weekday: 5, dpjpId: 'aha', name: 'Dr. dr. Abdul Hakim Alkatiri, Sp.JP(K)', clinic: '5 (Cardio PJT)', time: '08.00 - 16.30' },
  { weekday: 5, dpjpId: 'np', name: 'dr. Nurminsyah Purnamawan, Sp.Jp (K)', clinic: 'Poli Konsul & Echo IRJ', time: DAY },
];

export interface NextPoli {
  date: ClinicalDate;
  weekday: number;
  slot: PoliSlot;
  /** 0 = today, 1 = tomorrow. */
  inDays: number;
}

const WEEKDAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function weekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday] ?? '';
}

/**
 * The consultant's next clinic on or after `today`.
 *
 * Searches fourteen days, which covers two full cycles — enough that a
 * consultant listed once a week is always found, and short enough that "no
 * clinic" means they are genuinely not on this roster rather than that the
 * search gave up early.
 */
export function nextPoli(dpjpId: string, today: ClinicalDate): NextPoli | null {
  return upcomingPoli(dpjpId, today, 1)[0] ?? null;
}

/**
 * The consultant's next `count` clinics, in chronological order.
 *
 * Knowing only the next one is not enough to plan around: if the next clinic
 * is today or tomorrow, the resident needs the one after it to decide whether
 * a referral that misses today's list can still be seen this week, or has to
 * wait. So the caller asks for as many as it can show.
 *
 * Two changes from the single-slot version this replaced, both of which were
 * latent bugs rather than new behaviour:
 *
 *  - `filter` instead of `find` WITHIN a day. A consultant rostered twice on
 *    one weekday — a morning clinic and an afternoon one — had the second slot
 *    silently dropped, and asking for "the next two" would then have skipped a
 *    week to find a slot that was actually the same afternoon.
 *  - The 14-day window is now a bound on the SEARCH, not on the result. Two
 *    cycles is enough to find two slots for anyone rostered weekly; a
 *    consultant rostered less often than that yields fewer than `count`
 *    entries, which is the honest answer rather than a padded one.
 */
export function upcomingPoli(
  dpjpId: string,
  today: ClinicalDate,
  count: number,
): NextPoli[] {
  const found: NextPoli[] = [];
  if (count <= 0) return found;

  for (let offset = 0; offset < 14 && found.length < count; offset += 1) {
    const date = addDays(today, offset);
    // Parsed as UTC, like every other clinical date, so the weekday cannot
    // shift with the device timezone.
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();

    for (const slot of POLI_SCHEDULE) {
      if (slot.weekday !== weekday || slot.dpjpId !== dpjpId) continue;
      found.push({ date, weekday, slot, inDays: offset });
      if (found.length >= count) break;
    }
  }

  return found;
}

/** Consultants on the roster who are not in the DPJP registry. */
export function unregisteredNames(): string[] {
  const known = new Set(DPJPS.map((dpjp) => dpjp.id));
  return [
    ...new Set(
      POLI_SCHEDULE.filter((slot) => slot.dpjpId === null || !known.has(slot.dpjpId)).map(
        (slot) => slot.name,
      ),
    ),
  ];
}
