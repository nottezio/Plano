import type { JagaRosterKind } from './sync';

/**
 * Which of two versions of a roster is the LATEST DOCUMENT.
 *
 * "Imported last" is not the same thing. A phone that imported September and
 * a PC that later imported August's file by mistake would otherwise end with
 * August everywhere, since the PC's import is the more recent act. So the
 * document is judged by what it contains, in this order:
 *
 *   1. the last date it covers, then the first, from the parsed schedule;
 *   2. the PDF's own date (a corrected re-issue of the same month is newer);
 *   3. when it was imported, the last resort.
 *
 * A key that is missing on either side is skipped rather than decided. Rosters
 * stored before this existed have no document date, and a missing value must
 * not count as "oldest".
 *
 * Jarkom has no dates in its content, so for it only 2 and 3 apply.
 */

export interface Coverage {
  start: string;
  end: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function datesOf(kind: JagaRosterKind, doc: Record<string, unknown>): string[] {
  const list = kind === 'dpjp' ? doc.days : kind === 'jarkom' ? undefined : doc.shifts;
  if (!Array.isArray(list)) return [];
  return list
    .map((row) => (isRecord(row) && typeof row.date === 'string' ? row.date : null))
    .filter((date): date is string => date !== null && /^\d{4}-\d{2}-\d{2}$/.test(date));
}

export function coverageOf(kind: JagaRosterKind, doc: unknown): Coverage | null {
  if (!isRecord(doc)) return null;
  const dates = datesOf(kind, doc).sort();
  const start = dates[0];
  const end = dates.at(-1);
  return start && end ? { start, end } : null;
}

function documentDateOf(doc: unknown): string | null {
  if (!isRecord(doc) || !isRecord(doc.source)) return null;
  return typeof doc.source.documentDate === 'string' ? doc.source.documentDate : null;
}

function importedAtOf(doc: unknown): string | null {
  return isRecord(doc) && typeof doc.importedAt === 'string' ? doc.importedAt : null;
}

/**
 * Positive when `a` is the later document, negative when `b` is, zero when
 * nothing tells them apart. A missing document sorts before a present one.
 */
export function compareRosters(kind: JagaRosterKind, a: unknown, b: unknown): number {
  const hasA = isRecord(a);
  const hasB = isRecord(b);
  if (!hasA || !hasB) return Number(hasA) - Number(hasB);

  const ca = coverageOf(kind, a);
  const cb = coverageOf(kind, b);
  const keys: Array<[string | null, string | null]> = [
    [ca?.end ?? null, cb?.end ?? null],
    [ca?.start ?? null, cb?.start ?? null],
    [documentDateOf(a), documentDateOf(b)],
    [importedAtOf(a), importedAtOf(b)],
  ];
  for (const [left, right] of keys) {
    if (left === null || right === null || left === right) continue;
    return left > right ? 1 : -1;
  }
  return 0;
}

/**
 * Why a new import was refused, in words: what it covers against what is
 * already stored. `null` when the new one may replace the stored one.
 */
export function refuseOlder(
  kind: JagaRosterKind,
  incoming: unknown,
  stored: unknown,
): { incoming: string; stored: string } | null {
  if (stored === null || stored === undefined) return null;
  if (compareRosters(kind, incoming, stored) >= 0) return null;
  return { incoming: describeVersion(kind, incoming), stored: describeVersion(kind, stored) };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function shortDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1] ?? m} ${y}`;
}

/** e.g. `1 Sep 2026 – 31 Okt 2026 · dokumen 28 Agu 2026`. */
export function describeVersion(kind: JagaRosterKind, doc: unknown): string {
  const coverage = coverageOf(kind, doc);
  const documentDate = documentDateOf(doc);
  const parts: string[] = [];
  if (coverage) parts.push(`${shortDate(coverage.start)} – ${shortDate(coverage.end)}`);
  if (documentDate) parts.push(`dokumen ${shortDate(documentDate)}`);
  if (parts.length === 0) {
    const imported = importedAtOf(doc);
    parts.push(imported ? `diimpor ${shortDate(imported)}` : 'tanggal tidak diketahui');
  }
  return parts.join(' · ');
}

/**
 * The year for a sheet that names only its month (the Pediatri roster).
 *
 * The year nearest the date being viewed: a January sheet imported while
 * looking at December 2026 is January 2027, not January 2026. Taking the
 * viewed year as it stood would date it eleven months in the past, and the
 * newest-document rule would then refuse the newest document.
 */
export function nearestYear(month: number, viewed: string): number {
  const [vy, vm] = viewed.split('-').map(Number);
  if (!vy || !vm) return new Date().getFullYear();
  const candidates = [vy - 1, vy, vy + 1];
  const distance = (year: number): number => Math.abs(year * 12 + month - (vy * 12 + vm));
  return candidates.reduce((best, year) => (distance(year) < distance(best) ? year : best), vy);
}
