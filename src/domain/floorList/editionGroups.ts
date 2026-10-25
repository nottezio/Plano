import type { Edition } from './floor';

/** How many editions Riwayat lists live, and how many each "Muat edisi lebih lama" adds. */
export const EDITIONS_PAGE = 10;

export interface EditionDay {
  date: string;
  editions: Edition[];
}

/** Editions grouped by their list date, newest day first; within a day the given order is kept. */
export function groupByDay(editions: readonly Edition[]): EditionDay[] {
  const days = new Map<string, Edition[]>();
  for (const e of editions) days.set(e.date, [...(days.get(e.date) ?? []), e]);
  return [...days]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => ({ date, editions: list }));
}
