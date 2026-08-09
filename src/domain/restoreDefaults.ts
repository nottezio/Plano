/**
 * Restoring seeded settings.
 *
 * Templates, greetings and opening sentences are user data, so they get no
 * revision trail — but they START as seeds that live in code, which means the
 * defaults are always recoverable even when a customised version is not.
 *
 * Everything here MERGES rather than replaces. Restoring must never be a second
 * way to lose work: someone who deleted one preset and edited three others
 * needs the missing one back, not their three edits reverted. So a seed is
 * added only when nothing with the same identity is already present, and
 * whatever is there is left exactly as it is.
 */

/** Case- and whitespace-insensitive, since a rename is not a deletion. */
function identity(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Adds seeds that are missing, keyed by `keyOf`, preserving current order and
 * appending restored entries at the end.
 */
export function restoreMissing<T>(
  current: readonly T[],
  seeds: readonly T[],
  keyOf: (item: T) => string,
): { next: T[]; restored: number } {
  const present = new Set(current.map((item) => identity(keyOf(item))));
  const missing = seeds.filter((seed) => !present.has(identity(keyOf(seed))));

  return { next: [...current, ...missing], restored: missing.length };
}

/** Strings, the common case for greetings and opening sentences. */
export function restoreMissingStrings(
  current: readonly string[],
  seeds: readonly string[],
): { next: string[]; restored: number } {
  return restoreMissing(current, seeds, (value) => value);
}

export function restoredMessage(restored: number): string {
  if (restored === 0) return 'Semua format bawaan sudah ada.';
  return `${restored} format bawaan dipulihkan.`;
}
