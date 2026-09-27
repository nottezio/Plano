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

export interface JarkomResolution {
  /** The one row this name belongs to, or null. */
  entry: JarkomEntry | null;
  /**
   * When the name fits two or more rows EQUALLY well, those rows, and `entry`
   * is null. Shown to the user to pick from; never decided here.
   */
  ambiguous: JarkomEntry[];
}

/**
 * How many rows each word appears in. A word on four rows (`ahmad`) says far
 * less about who is meant than a word on one (`yusuf`).
 */
function wordCounts(directory: JarkomDirectory): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of directory.entries) {
    for (const token of new Set(nameTokens(entry.name))) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Match a legend name to a Jarkom row, or say that it cannot be told apart.
 *
 * Ranked by the share of words in common, then by how RARE those shared words
 * are. A tie on both is reported as ambiguous instead of settled by row order.
 * Row order is what used to settle it: the legend's `dr. Ahmad Rizki Yusuf`
 * (a typo for Rifqi) shares two words with `dr. Ahmad Rizki Imran` and two
 * with `dr. Ahmad Rifqi Yusuf`, and the earlier row won silently, so the
 * wrong nickname was printed and nothing on screen said a choice had been made.
 */
export function resolveJarkom(name: string, directory: JarkomDirectory): JarkomResolution {
  const wanted = nameTokens(name);
  if (wanted.length === 0) return { entry: null, ambiguous: [] };
  const counts = wordCounts(directory);

  const scored: Array<{ entry: JarkomEntry; score: number; rarity: number; passes: boolean }> = [];
  for (const entry of directory.entries) {
    const tokens = nameTokens(entry.name);
    const hits = wanted.filter((token) => tokens.some((other) => sameWord(token, other)));
    if (hits.length === 0) continue;
    // Normalised so a four-word name does not out-score a two-word one purely
    // by having more chances to hit.
    const score = hits.length / Math.min(wanted.length, tokens.length);
    const rarity = hits.reduce((sum, token) => {
      const match = tokens.find((other) => sameWord(token, other)) ?? token;
      return sum + 1 / (counts.get(match) ?? 1);
    }, 0);
    // One shared word is a coincidence in a list this size — there are four
    // residents whose only distinctive token is `nurul`.
    const minimumShared = Math.min(tokens.length, wanted.length) >= 2 ? 2 : 1;
    scored.push({ entry, score, rarity, passes: hits.length >= minimumShared });
  }
  if (scored.length === 0) return { entry: null, ambiguous: [] };

  const EPS = 1e-9;
  scored.sort((a, b) => b.score - a.score || b.rarity - a.rarity);
  const best = scored[0]!;
  if (!best.passes) return { entry: null, ambiguous: [] };
  const tied = scored.filter(
    (other) =>
      other.passes &&
      Math.abs(other.score - best.score) < EPS &&
      Math.abs(other.rarity - best.rarity) < EPS,
  );
  return tied.length > 1
    ? { entry: null, ambiguous: tied.map((other) => other.entry) }
    : { entry: best.entry, ambiguous: [] };
}

export function matchJarkom(name: string, directory: JarkomDirectory): JarkomEntry | null {
  return resolveJarkom(name, directory).entry;
}

/**
 * The row a legend name belongs to, honouring a link the user made by hand
 * (`store.setJarkomLink`, keyed by initials, holding the Jarkom row's name).
 * A link to a row that a newer Jarkom import no longer has is ignored, and
 * matching takes over again.
 */
export function jarkomFor(
  initials: string,
  name: string | null,
  directory: JarkomDirectory | null,
  links: Readonly<Record<string, string>>,
): JarkomResolution & { linked: boolean } {
  if (!directory) return { entry: null, ambiguous: [], linked: false };
  const link = initials ? links[initials] : undefined;
  const linked = link ? directory.entries.find((entry) => entry.name === link) : undefined;
  if (linked) return { entry: linked, ambiguous: [], linked: true };
  return name ? { ...resolveJarkom(name, directory), linked: false } : { entry: null, ambiguous: [], linked: false };
}
