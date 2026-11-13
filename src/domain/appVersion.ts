/**
 * Comparing app versions (`YYYY-MM-DD.N`, see `src/version.js`).
 *
 * Never compare these as strings: on the same day, build 10 sorts BEFORE
 * build 9. The build number N is compared as a number.
 */

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})\.(\d+)$/;

function parse(value: string): number[] | null {
  const match = PATTERN.exec(value.trim());
  return match ? match.slice(1).map(Number) : null;
}

export const isValidAppVersion = (value: string): boolean => parse(value) !== null;

/**
 * True when `version` is a real version older than a real `minimum`.
 * Anything unreadable on either side is "not older": a garbled value must
 * never nag a resident to update.
 */
export function isOlderVersion(version: string, minimum: string): boolean {
  const a = parse(version);
  const b = parse(minimum);
  if (!a || !b) return false;
  for (let i = 0; i < a.length; i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff < 0;
  }
  return false;
}
