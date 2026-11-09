import { effective, type Edition, type FloorDoc, type RosterPatient } from './floor';

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
 * Monday 07.00.
 *
 * EARLY (1 Nov 2026): the list is printed hours before 07.00, so a handover
 * that only appeared at 07.00 came too late. The suggestion is open all the
 * time now, from the end of the previous jam dinas (16.00) on, and Terima
 * changes the chief at once so the printed list is already right.
 *
 * 24 HOURS (7 Nov 2026, owner): weekend and holiday shifts run 07.00-19.00 and
 * 19.00-07.00, and the handover should not show more than 24 hours before the
 * change. So after a working day it opens at 16.00, and after a day off at
 * 07.00: Sunday 07.00 for Monday 07.00, and nothing from Friday 16.00 until then.
 *
 * TANGGAL MERAH (7 Nov 2026, owner): the list's editors mark them in Setelan
 * (`floor.holidays`). A marked weekday is a day off like Sunday. One not marked
 * still reads as a working day, and the list maker taps Abaikan.
 *
 * Only ever a SUGGESTION: the chief changes on a tap (Terima), never by itself.
 */

const START_HOUR = 7;
const END_HOUR = 16;
/** A day off's day shift ends at 19.00 (7 Nov 2026, owner). */
const OFF_END_HOUR = 19;

/** A local date as `floor.holidays` stores it. */
export const localIso = (at: Date): string =>
  `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;

const isWorkDay = (at: Date, holidays: readonly string[]): boolean =>
  at.getDay() >= 1 && at.getDay() <= 5 && !holidays.includes(localIso(at));

const dayAfter = (at: Date): Date => new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1);

/** Today's handover until the end of jam dinas, or tomorrow's within 24 hours of 07.00. */
function handoverOpen(now: Date, holidays: readonly string[]): boolean {
  const hour = now.getHours();
  return (isWorkDay(now, holidays) && hour < END_HOUR) || (isWorkDay(dayAfter(now), holidays) && hour >= START_HOUR);
}

/**
 * Where an Abaikan stops holding: the moment the current handover opened, the
 * latest eve of a working day (16.00 after a working day, 07.00 after a day off)
 * not after `now`. Dismissed on Sunday or in Monday's jam dinas, it holds through
 * Monday; from Monday 16.00 the Tuesday handover is a new question.
 */
export function handoverCycleStart(now: Date, holidays: readonly string[] = []): Date {
  for (let back = 0; ; back += 1) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    if (!isWorkDay(dayAfter(at), holidays)) continue;
    at.setHours(isWorkDay(at, holidays) ? END_HOUR : START_HOUR);
    if (at <= now) return at;
  }
}

/**
 * When the current shift began (8 Nov 2026, Avi: "pasien baru" = not on the
 * previous shift's list): 07.00 and 16.00 on a working day, 07.00 and 19.00
 * on a day off or tanggal merah.
 */
export function shiftStart(now: Date, holidays: readonly string[] = []): Date {
  for (let back = 0; ; back += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const late = new Date(day);
    late.setHours(isWorkDay(day, holidays) ? END_HOUR : OFF_END_HOUR);
    if (late <= now) return late;
    day.setHours(START_HOUR);
    if (day <= now) return day;
  }
}

/**
 * The keys on the previous shift's list (see `shiftEdition`); null when there
 * is none. A list for the current shift, a re-send included, never counts, so
 * the tags hold all shift.
 */
export function shiftBaseline(editions: readonly Edition[], before: string): ReadonlySet<string> | null {
  const last = shiftEdition(editions, before);
  return last ? new Set(last.patients.map((p) => p.key)) : null;
}

/** The moment a list is for, from its date and Jam list ("04.00", "16.00 shift"), as an ISO time; null when the Jam list holds no time. */
function listMoment(edition: Edition): string | null {
  const time = /(\d{1,2})[.:](\d{2})/.exec(edition.time);
  const [year, month, day] = edition.date.split('-').map(Number);
  if (!time || !year || !month || !day) return null;
  const [hour, minute] = [Number(time[1]), Number(time[2])];
  if (hour > 23 || minute > 59) return null;
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

/**
 * The previous shift's list (also its Denah snapshot, 9 Nov 2026): the newest
 * list whose date and Jam list are at or before `before`, the shift start.
 *
 * BY JAM LIST (10 Nov 2026, Avi): the list maker saves early or late. A 04.00
 * list saved at 07.40 was "saved after the shift began" and skipped, so the
 * day before's list became the baseline and every overnight patient read as
 * "Pasien baru" all day. The Jam list says which list it is, whenever it was
 * saved. Two lists with one Jam list: the one saved last. A Jam list with no
 * time ("—") falls back to when it was saved.
 */
export function shiftEdition(editions: readonly Edition[], before: string): Edition | null {
  let last: Edition | null = null;
  let lastAt = '';
  for (const edition of editions) {
    const moment = listMoment(edition);
    if (moment ? moment > before : edition.createdAt >= before) continue;
    const at = moment ?? edition.createdAt;
    if (!last || at > lastAt || (at === lastAt && edition.createdAt > last.createdAt)) {
      last = edition;
      lastAt = at;
    }
  }
  return last;
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
 * planned handover to someone else). Open except in the gap before the eve of
 * a working day (see EARLY, 24 HOURS and TANGGAL MERAH above).
 */
export function chiefSuggestions(
  roster: readonly RosterPatient[],
  floor: FloorDoc,
  date: string,
  now: Date,
): ChiefSuggestion[] {
  const bangsal = floor.chiefBangsal.trim();
  if (!bangsal || !handoverOpen(now, floor.holidays)) return [];
  const cycleStart = handoverCycleStart(now, floor.holidays);
  const out: ChiefSuggestion[] = [];
  for (const entry of roster) {
    if (entry.status !== 'dirawat') continue;
    const seen = effective(entry, floor, date);
    // Held by a division, or tagged "tidak di-follow up" (titipan, chosen DPJPs): not the ward's to hand over.
    if (seen.division || seen.tags?.some((t) => t.noFollowUp)) continue;
    const from = seen.chief;
    const to = entry.gantiChief.trim() || bangsal;
    if (from && samePerson(from, to)) continue;
    if (entry.chiefDismissed) {
      // No chief at all: the list maker said no once, for good (owner, 24 Oct 2026).
      if (!from) continue;
      if (new Date(entry.chiefDismissed) >= cycleStart) continue;
    }
    out.push({ entry, from, to });
  }
  return out;
}
