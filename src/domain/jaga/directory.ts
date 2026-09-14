import { matchJarkom } from './match';
import type { JagaRoster, JarkomDirectory } from './types';

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
}

export function buildDirectory(
  roster: JagaRoster | null,
  jarkom: JarkomDirectory | null,
): Resident[] {
  if (!roster) return [];
  return Object.entries(roster.initials)
    .map(([initials, name]) => {
      const entry = jarkom ? matchJarkom(name, jarkom) : null;
      return {
        initials,
        name,
        panggilan: entry?.panggilan ?? null,
        muslim: entry ? entry.muslim : null,
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
