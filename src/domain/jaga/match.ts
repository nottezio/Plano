import type { JarkomDirectory, JarkomEntry } from './types';

/**
 * Match a name from the roster legend to a row in the Jarkom sheet.
 *
 * They are two documents typed by two people and the same person is spelled
 * differently in each — `dr. Grafiek Fogar Filen` in the roster is
 * `dr. Greafiek Fogar Filen Nando` in Jarkom. An exact match finds barely half
 * of them, so this scores token overlap instead.
 *
 * Scoring rather than fuzzy-distance because the failure modes differ. Edit
 * distance treats `Muhammad Asrul` and `Muhammad Abdul` as near-identical,
 * which is exactly the confusion to avoid in a list of ninety colleagues who
 * share given names. Requiring whole matching WORDS, and at least two of them
 * where both names have two, refuses rather than guesses.
 *
 * When nothing scores high enough the caller gets `null` and shows the
 * initials as they were printed — the honest result, and still usable, because
 * the person reading the list knows who `AV` is.
 */
const NOISE = new Set(['dr', 'drg', 'prof', 'a', 'm', 'muh', 'muhammad', 'andi', 'rr']);

export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !NOISE.has(token));
}

/**
 * Do two name-words refer to the same word, allowing one typo?
 *
 * The two documents disagree by a single letter on real people — `Marylin` and
 * `Marilyn`, `Montong` and `Mantong`, `Fitri` and `Fitria`. Requiring exact
 * words loses all of them; allowing free fuzziness would start merging the
 * Muhammads. One edit, on words of five letters or more, is the narrowest rule
 * that catches the observed cases and cannot reach a different given name.
 */
function sameWord(left: string, right: string): boolean {
  if (left === right) return true;
  if (left.length < 5 || right.length < 5) return false;
  if (Math.abs(left.length - right.length) > 1) return false;

  // One substitution, or one insertion — walked in a single pass rather than a
  // distance matrix, because only a budget of one is ever allowed.
  let a = 0;
  let b = 0;
  let edits = 0;
  while (a < left.length && b < right.length) {
    if (left[a] === right[b]) {
      a += 1;
      b += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) a += 1;
    else if (right.length > left.length) b += 1;
    else {
      a += 1;
      b += 1;
    }
  }
  return edits + (left.length - a) + (right.length - b) <= 1;
}

function sharedTokens(wanted: readonly string[], tokens: readonly string[]): number {
  return wanted.filter((token) => tokens.some((other) => sameWord(token, other))).length;
}

export function matchJarkom(name: string, directory: JarkomDirectory): JarkomEntry | null {
  const wanted = nameTokens(name);
  if (wanted.length === 0) return null;

  let best: { entry: JarkomEntry; score: number } | null = null;

  for (const entry of directory.entries) {
    const tokens = nameTokens(entry.name);
    const shared = sharedTokens(wanted, tokens);
    if (shared === 0) continue;
    // Normalised so a four-word name does not out-score a two-word one purely
    // by having more chances to hit.
    const score = shared / Math.min(wanted.length, tokens.length);
    if (!best || score > best.score) best = { entry, score };
  }

  if (!best) return null;
  // One shared word is a coincidence in a list this size — there are four
  // residents whose only distinctive token is `nurul`.
  const minimumShared = Math.min(nameTokens(best.entry.name).length, wanted.length) >= 2 ? 2 : 1;
  const shared = sharedTokens(wanted, nameTokens(best.entry.name));
  return shared >= minimumShared ? best.entry : null;
}
