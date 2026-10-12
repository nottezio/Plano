import { DPJPS, type Dpjp } from '../dpjp';

/**
 * DPJP Onsite IGD, 14.00–21.00 (Avi, 2026-10-12): one consultant per weekday,
 * none on Sunday.
 *
 *   Senin KS · Selasa ZD · Rabu AHN · Kamis MAA · Jumat AHA · Sabtu Prof. MZ
 *
 * Printed in the Formasi Jaga under the day's DPJP. Keyed by weekday (0 =
 * Minggu, as `Date.getUTCDay`), and by registry id so the name is the one
 * the rest of Plano writes.
 */
export const ONSITE_IGD_HOURS = '14.00–21.00';

export const ONSITE_IGD: Readonly<Record<number, string>> = {
  1: 'ks',
  2: 'zd',
  3: 'ahn',
  4: 'maa',
  5: 'aha',
  6: 'mz',
};

/** The onsite consultant for an ISO date, or null (Sunday, unknown date). */
export function onsiteFor(date: string): Dpjp | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const id = ONSITE_IGD[new Date(`${date}T00:00:00Z`).getUTCDay()];
  return id ? (DPJPS.find((dpjp) => dpjp.id === id) ?? null) : null;
}
