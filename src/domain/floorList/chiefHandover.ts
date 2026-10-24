import { effective, type FloorDoc, type RosterPatient } from './floor';

/**
 * Chief Bangsal handover suggestions (24 Oct 2026).
 *
 * THE WORKFLOW: a patient who arrives in jam dinas (Mon–Fri 07.00–16.00)
 * belongs to the Chief Bangsal at once. One who arrives outside it (evening,
 * night, weekend, tanggal merah) keeps the previous chief (IGD, the previous
 * room, or the Chief Jaga for a Poli preadmission) until the next jam dinas,
 * when the Chief Bangsal takes over.
 *
 * WHY NO ENTRY TIME: the rule only needs "now is jam dinas and the chief is
 * not the Chief Bangsal". A patient who arrived in jam dinas already has the
 * Chief Bangsal, so nothing is suggested; one from Friday night shows up on
 * Monday 07.00. Tanggal merah are not known (no holiday list): the list maker
 * taps Abaikan, which lasts until the next jam dinas.
 *
 * Only ever a SUGGESTION: the chief changes on a tap (Terima), never by itself.
 */

const START_HOUR = 7;
const END_HOUR = 16;

const isWeekday = (at: Date): boolean => at.getDay() >= 1 && at.getDay() <= 5;

/** Mon–Fri, 07.00 up to (not including) 16.00, on the device clock. */
export function isJamDinas(now: Date): boolean {
  return isWeekday(now) && now.getHours() >= START_HOUR && now.getHours() < END_HOUR;
}

/** 07.00 on `now`'s day: a dismissal before it belongs to an earlier block. */
export function jamDinasBlockStart(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), START_HOUR);
}

/** When the next jam dinas starts: today 07.00 if still ahead, else the next weekday's. */
export function nextJamDinas(now: Date): Date {
  const next = jamDinasBlockStart(now);
  if (isWeekday(next) && now < next) return next;
  do next.setDate(next.getDate() + 1);
  while (!isWeekday(next));
  return next;
}

export interface ChiefSuggestion {
  entry: RosterPatient;
  /** The chief now; '' = none written. */
  from: string;
  to: string;
}

// "dr." / "dr " only: "Drajat" keeps its letters.
const withoutDr = (name: string): string => name.replace(/^dr(\.\s*|\s+)/i, '');

/**
 * "dr. Kirana", "kirana", "Kirana A" and "Kirana" are one chief; "Ari" and
 * "Arif", "Rizky" and "Rizka" are two. Not `rosterName`'s prefix / one-letter
 * match: against a single name it merges different residents, and a merge
 * here hides a handover.
 */
function samePerson(a: string, b: string): boolean {
  const words = (value: string): string[] =>
    withoutDr(value).toLowerCase().split(/\s+/).map((w) => w.replace(/[^a-z]/g, '')).filter(Boolean);
  const [x, y] = [words(a), words(b)];
  if (x.join('') === y.join('')) return true;
  // Same first name, and the rest only initials ("Kirana A").
  const initials = (rest: string[]): boolean => rest.every((w) => w.length <= 2);
  return x[0] !== undefined && x[0] === y[0] && initials(x.slice(1)) && initials(y.slice(1));
}

/**
 * The patients to hand to the Chief Bangsal (or to their Ganti chief, a
 * planned handover to someone else). `ignoreClock`: outside jam dinas, for
 * the "ganti chief Senin 07.00" reminder line.
 */
export function chiefSuggestions(
  roster: readonly RosterPatient[],
  floor: FloorDoc,
  date: string,
  now: Date,
  opts: { ignoreClock?: boolean } = {},
): ChiefSuggestion[] {
  const bangsal = floor.chiefBangsal.trim();
  if (!bangsal) return [];
  if (!opts.ignoreClock && !isJamDinas(now)) return [];
  const blockStart = jamDinasBlockStart(now);
  const out: ChiefSuggestion[] = [];
  for (const entry of roster) {
    if (entry.status !== 'dirawat') continue;
    const seen = effective(entry, floor, date);
    if (seen.division) continue;
    const from = seen.chief;
    const to = entry.gantiChief.trim() || bangsal;
    if (from && samePerson(from, to)) continue;
    if (entry.chiefDismissed) {
      // No chief at all: the list maker said no once, for good (owner, 24 Oct 2026).
      if (!from) continue;
      if (!opts.ignoreClock && new Date(entry.chiefDismissed) >= blockStart) continue;
    }
    out.push({ entry, from, to });
  }
  return out;
}
