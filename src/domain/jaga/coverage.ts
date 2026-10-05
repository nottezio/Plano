import { nextDate } from './formasi';
import type { DpjpRoster, JagaShift } from './types';

/**
 * What an imported schedule does NOT cover (2026-10-05).
 *
 * The October DPJP sheet imported "successfully" with 27 of its 31 days: four
 * rows drew their date in two pieces and were skipped, and the Formasi for 6
 * October then printed no DPJP block at all. Nothing on screen said a day was
 * missing — the import card read "27 hari", which looks like a number, not a
 * fault.
 *
 * The parser is fixed, but the class of failure is a parse that is PARTIAL and
 * SILENT, and the next layout change will find another way to cause it. So
 * every import is checked for holes, and so is the Formasi being built: the
 * screen says which dates are missing instead of quietly leaving them out.
 */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function addDay(iso: string): string {
  const at = new Date(`${iso}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + 1);
  return at.toISOString().slice(0, 10);
}

function lastOfMonth(iso: string): string {
  const at = new Date(`${iso.slice(0, 7)}-01T00:00:00Z`);
  at.setUTCMonth(at.getUTCMonth() + 1);
  at.setUTCDate(0);
  return at.toISOString().slice(0, 10);
}

/**
 * Dates between the first and last covered that are not covered.
 *
 * `wholeMonths` widens that to the full calendar months touched: the DPJP
 * sheet is one month, so a sheet whose first row is the 3rd is also missing
 * the 1st and 2nd. The resident roster runs mid-month to mid-month
 * (1 Oktober – 15 November), so for it only the inside gaps count.
 */
export function missingDates(
  dates: readonly string[],
  { wholeMonths = false }: { wholeMonths?: boolean } = {},
): string[] {
  const sorted = [...new Set(dates)].filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return [];
  const start = wholeMonths ? `${first.slice(0, 7)}-01` : first;
  const end = wholeMonths ? lastOfMonth(last) : last;
  const have = new Set(sorted);
  const missing: string[] = [];
  // Bounded: a corrupt date cannot make this loop run away.
  for (let date = start, guard = 0; date <= end && guard < 400; date = addDay(date), guard += 1) {
    if (!have.has(date)) missing.push(date);
  }
  return missing;
}

/** `5–8 Okt, 24 Okt` — consecutive dates folded into ranges. */
export function describeDates(dates: readonly string[]): string {
  const sorted = [...new Set(dates)].sort();
  const parts: string[] = [];
  let runStart: string | null = null;
  let previous: string | null = null;
  const flush = (): void => {
    if (!runStart || !previous) return;
    const month = MONTHS_SHORT[Number(previous.slice(5, 7)) - 1] ?? '';
    const from = Number(runStart.slice(8, 10));
    const to = Number(previous.slice(8, 10));
    const sameMonth = runStart.slice(0, 7) === previous.slice(0, 7);
    parts.push(
      from === to && sameMonth
        ? `${to} ${month}`
        : sameMonth
          ? `${from}–${to} ${month}`
          : `${from} ${MONTHS_SHORT[Number(runStart.slice(5, 7)) - 1] ?? ''}–${to} ${month}`,
    );
  };
  for (const date of sorted) {
    if (previous && addDay(previous) === date) {
      previous = date;
      continue;
    }
    flush();
    runStart = date;
    previous = date;
  }
  flush();
  return parts.join(', ');
}

/**
 * The dates this shift's Formasi prints a DPJP block for, that have no DPJP.
 *
 * Mirrors `buildFormasi`: the shift's own date always, the next date unless it
 * is a PAGI team (who hand over before midnight). A date counts as covered by
 * the imported sheet OR by a hand edit — a tukar jaga entered for a date the
 * sheet lacks fills it.
 */
export function dpjpGaps(
  shift: Pick<JagaShift, 'date' | 'shift'>,
  dpjp: DpjpRoster | null,
  edits?: Record<string, { utama?: string; tindakan?: string }>,
): string[] {
  const wanted = shift.shift === 'pagi' ? [shift.date] : [shift.date, nextDate(shift.date)];
  return wanted.filter((date) => {
    const day = dpjp?.days.find((entry) => entry.date === date);
    const edit = edits?.[date];
    return !(day?.utama || day?.tindakan || edit?.utama || edit?.tindakan);
  });
}
