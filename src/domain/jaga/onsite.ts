import { DPJPS, type Dpjp } from '../dpjp';
import type { JagaShift } from './types';

/**
 * DPJP Onsite IGD, 14.00–21.00: one consultant per weekday.
 *
 * Avi's schedule (2026-10-12) is the DEFAULT, not the source of truth: since
 * 12.5 it is an account setting (`UserSettings.onsiteIgd`), edited under the
 * Formasi, because a swap or a new rota is a configuration change and a
 * release is the wrong unit for that.
 *
 *   Senin KS · Selasa ZD · Rabu AHN · Kamis MAA · Jumat AHA · Sabtu Prof. MZ
 *
 * Keyed by weekday as a STRING ('0' = Minggu, as `Date.getUTCDay`), so the
 * stored map is a Firestore map whose leaves can be written one at a time.
 * The value is a registry id, so the name printed is the one the rest of
 * Plano writes; '' = nobody that day.
 *
 * `malam`: whether the MALAM team's Formasi carries the line too. A night team
 * normally starts after the onsite hours, but the Saturday night team does
 * get it (Avi, 2026-10-12).
 */
export const ONSITE_IGD_HOURS = '14.00–21.00';

export interface OnsiteDay {
  /** Registry id (`DPJPS`), or '' for nobody. */
  id: string;
  /** Printed for the MALAM team as well. */
  malam: boolean;
}

export type OnsiteSchedule = Readonly<Record<string, OnsiteDay>>;

export const WEEKDAYS = ['0', '1', '2', '3', '4', '5', '6'] as const;

export const WEEKDAY_LABEL: Readonly<Record<string, string>> = {
  '0': 'Minggu',
  '1': 'Senin',
  '2': 'Selasa',
  '3': 'Rabu',
  '4': 'Kamis',
  '5': 'Jumat',
  '6': 'Sabtu',
};

export const DEFAULT_ONSITE_IGD: OnsiteSchedule = {
  '0': { id: '', malam: false },
  '1': { id: 'ks', malam: false },
  '2': { id: 'zd', malam: false },
  '3': { id: 'ahn', malam: false },
  '4': { id: 'maa', malam: false },
  '5': { id: 'aha', malam: false },
  '6': { id: 'mz', malam: true },
};

/**
 * The effective schedule: what the account saved, day by day, over the
 * default. Per DAY and per FIELD, so a profile that has only ever edited
 * Saturday still gets Avi's other six days, and a stored day missing `malam`
 * keeps the default flag rather than reading it as false.
 */
export function onsiteSchedule(saved?: Readonly<Record<string, Partial<OnsiteDay> | undefined>> | null): OnsiteSchedule {
  const out: Record<string, OnsiteDay> = {};
  for (const day of WEEKDAYS) {
    const base = DEFAULT_ONSITE_IGD[day]!;
    const stored = saved?.[day];
    out[day] = {
      id: typeof stored?.id === 'string' ? stored.id : base.id,
      malam: typeof stored?.malam === 'boolean' ? stored.malam : base.malam,
    };
  }
  return out;
}

/**
 * The onsite consultant for a shift, or null (nobody that weekday, a MALAM
 * team on a day not flagged for it, an unreadable date, an id not in the
 * registry).
 */
export function onsiteFor(
  date: string,
  shift: JagaShift['shift'] = 'penuh',
  schedule: OnsiteSchedule = DEFAULT_ONSITE_IGD,
): Dpjp | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const day = schedule[String(new Date(`${date}T00:00:00Z`).getUTCDay())];
  if (!day?.id) return null;
  if (shift === 'malam' && !day.malam) return null;
  return DPJPS.find((dpjp) => dpjp.id === day.id) ?? null;
}
