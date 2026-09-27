import { jarkomFor } from './match';
import type { JagaRoster, JarkomDirectory, JarkomEntry } from './types';

/**
 * Everyone the app knows about, from the two imported documents joined once.
 *
 * Built for swapping. A tukar jaga names a PERSON — "Jordy is on for Rheza" —
 * and typing that person's name as free text loses everything else about them:
 * their agama, and therefore the greeting the confirmation message opens with.
 * A resident picked from here brings all of it.
 *
 * The roster legend is the spine, not Jarkom. The legend is who is actually on
 * the rota this month; Jarkom is a semester-old directory that supplies the
 * nickname and the agama and nothing else. A resident in Jarkom who is not on
 * the rota cannot be swapped in, which is correct.
 */
export interface Resident {
  initials: string;
  /** As the roster legend spells it — never Jarkom's spelling. */
  name: string;
  panggilan: string | null;
  muslim: boolean | null;
  /** The Jarkom row was picked by hand. */
  linked: boolean;
  /** Jarkom rows the legend name fits equally; empty unless undecidable. */
  ambiguous: JarkomEntry[];
}

export function buildDirectory(
  roster: JagaRoster | null,
  jarkom: JarkomDirectory | null,
  /** Jarkom rows picked by hand; see `store.setJarkomLink`. */
  links: Readonly<Record<string, string>> = {},
): Resident[] {
  if (!roster) return [];
  return Object.entries(roster.initials)
    .map(([initials, legendName]) => {
      const { entry, linked, ambiguous } = jarkomFor(initials, legendName, jarkom, links);
      return {
        initials,
        name: linked && entry ? entry.name : legendName,
        panggilan: entry?.panggilan ?? null,
        muslim: entry ? entry.muslim : null,
        linked,
        ambiguous,
      };
    })
    .sort((left, right) =>
      (left.panggilan ?? left.name).localeCompare(right.panggilan ?? right.name),
    );
}

/**
 * Find residents by nickname, full name or initials.
 *
 * Nickname FIRST in the ranking, because that is what a resident is called and
 * therefore what gets typed. Searching the full name only would mean typing
 * "Rheza" finds nothing for `dr. M. Rheza Rivaldi Salam` — the nickname is the
 * one string that matches how the swap was described out loud.
 *
 * Substring rather than prefix: half these names begin with `dr.` or a
 * initial-letter, and requiring a word start would hide most of the list
 * behind knowing how it is spelled.
 */
export function searchResidents(
  residents: readonly Resident[],
  query: string,
  limit = 6,
): Resident[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const scored = residents
    .map((resident) => {
      const panggilan = (resident.panggilan ?? '').toLowerCase();
      const name = resident.name.toLowerCase();
      const initials = resident.initials.toLowerCase();

      // Exact initials beat everything: somebody typing `AV` means that person
      // and nothing else.
      if (initials === needle) return { resident, score: 0 };
      if (panggilan === needle) return { resident, score: 1 };
      if (panggilan.startsWith(needle)) return { resident, score: 2 };
      if (panggilan.includes(needle)) return { resident, score: 3 };
      if (name.includes(needle)) return { resident, score: 4 };
      return null;
    })
    .filter((hit): hit is { resident: Resident; score: number } => hit !== null)
    .sort((left, right) => left.score - right.score);

  return scored.slice(0, limit).map((hit) => hit.resident);
}

/**
 * A swap as it should read NOW. A swap stores the person picked (initials)
 * with the nickname and agama known at the time; when the directory has since
 * learned better — a Jarkom row linked by hand — the directory wins, so fixing
 * a person once fixes every night they were swapped onto too. A swap typed as
 * free text (no initials) is left exactly as typed.
 */
export function refreshSwap<T extends { name: string; initials?: string; muslim?: boolean }>(
  swap: T,
  residents: readonly Resident[],
): T {
  if (!swap.initials) return swap;
  const resident = residents.find((entry) => entry.initials === swap.initials);
  if (!resident || !resident.panggilan) return swap;
  return {
    ...swap,
    name: resident.panggilan,
    ...(resident.muslim === null ? {} : { muslim: resident.muslim }),
  };
}
