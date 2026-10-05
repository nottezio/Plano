/**
 * The value that disagrees, in a comparison of views.
 *
 * "room 404 bed 2" three times and "room 402 bed 2" once: the one to look at
 * is the odd one out, so it is marked. With no majority (two against two),
 * nothing is, since there is no telling which side is wrong.
 */
export function oddValues(values: readonly string[]): Set<string> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  if (counts.size < 2) return new Set();
  const top = Math.max(...counts.values());
  const leaders = [...counts].filter(([, count]) => count === top);
  if (leaders.length > 1) return new Set();
  return new Set([...counts.keys()].filter((value) => value !== leaders[0]?.[0]));
}
