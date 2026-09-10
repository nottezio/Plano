import type { ClinicalDate } from './types';

/**
 * The `H-` counters, and why they go stale.
 *
 * A note carries running day counts — `post PPM H-2`, `Ceftriaxone 2gr/24
 * jam/IV (H-3)`, `Paska tindakan CABG hari ke-3`. They are the one part of a
 * carried-forward note that is wrong the moment it is copied, and wrong in a
 * way that reads as correct: `H-3` on day four is a plausible number in a
 * plausible place, so nothing about it looks like an error.
 *
 * Everything else carry-forward touches is either cleared (S, vitals) or still
 * true tomorrow (diagnoses, therapy). These are the only fields whose right
 * value is a function of the date, which is why they are handled here rather
 * than left to be noticed.
 *
 * WHAT IS MATCHED, AND WHAT IS DELIBERATELY NOT
 *
 * `H-3`, `H3`, `H +3`, `hari ke-3`, `hari ke 3`. Case-insensitive, because the
 * corpus writes all of them.
 *
 * NOT matched: a bare number, a date, or `H` followed by anything that is not a
 * count. Bumping something that was not a day counter is far worse than missing
 * one — a missed counter is a number the resident was already going to check,
 * an invented one is a number nobody knows is wrong.
 *
 * The boundaries are spelled out rather than written as `\b`, because `_` is a
 * word character and the notes are full of them: `_Paska tindakan CABG hari
 * ke-9_` has an underscore hard against the 9, so `\b` found no boundary there
 * and the marker was invisible. Every counter inside an italic line — which is
 * most of them, since the post-procedure lines live in the italic opening zone
 * — would have been silently skipped.
 */
const MARKER = /(?<![A-Za-z0-9])(H\s*[-+]?\s*|hari\s+ke\s*-?\s*)(\d{1,3})(?!\d)/gi;

export interface DayMarker {
  /** The whole matched text, e.g. `H-3`. */
  text: string;
  value: number;
  /**
   * Where it is in the body, as character offsets into the string passed in.
   *
   * Carried because the caller's job is to point AT the counter, not to
   * describe it. The banner previously listed `H-2, H-3, hari ke-9` and left
   * the user to find three needles by eye in a note that is often forty lines
   * long — the list said how many there were and nothing about where, which is
   * the harder half of the question.
   *
   * These offsets are valid ONLY against the exact string they were found in.
   * They go stale on the next keystroke, so a consumer that stores them across
   * an edit is storing a lie: re-run the search against the current body
   * instead. `findDayMarker` below exists so that is the easy path.
   */
  start: number;
  end: number;
}

export function findDayMarkers(body: string): DayMarker[] {
  return [...body.matchAll(MARKER)].map((match) => ({
    text: match[0],
    value: Number(match[2]),
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}

/**
 * Find the `occurrence`-th counter whose text matches `text`, in the body as it
 * is RIGHT NOW.
 *
 * Deliberately searches by text rather than by a remembered offset. The stale
 * list is captured at carry-forward and the note is edited afterwards — every
 * character typed above a counter moves it, so a stored offset points at the
 * wrong place by the time anyone clicks. Text survives editing; a position does
 * not.
 *
 * Comparison is case-insensitive and whitespace-collapsed for the same reason
 * the matcher is: the corpus writes `H-3`, `H - 3` and `hari ke 3` for the same
 * thing, and a jump button that silently does nothing because of a space is
 * worse than no jump button.
 *
 * `occurrence` wraps. Three lines reading `H-3` are one item in the list and
 * three places in the note; pressing it repeatedly walks them and returns to
 * the first, rather than stopping at the last and appearing broken.
 */
export function findDayMarker(
  body: string,
  text: string,
  occurrence = 0,
): DayMarker | null {
  const key = (value: string): string => value.replace(/\s+/g, '').toLowerCase();
  const matches = findDayMarkers(body).filter((marker) => key(marker.text) === key(text));
  if (matches.length === 0) return null;
  return matches[occurrence % matches.length] ?? null;
}

/** How many times a counter appears in the body as it is right now. */
export function countDayMarker(body: string, text: string): number {
  const key = (value: string): string => value.replace(/\s+/g, '').toLowerCase();
  return findDayMarkers(body).filter((marker) => key(marker.text) === key(text)).length;
}

/**
 * Advance every day counter by `days`.
 *
 * NOT used by carry-forward, deliberately, and the reason is worth keeping
 * here so it is not "fixed" back in.
 *
 * Advancing automatically looks obviously right and is not: the counters in a
 * note do not all measure the same thing. `H-3` on an antibiotic counts doses
 * given and stops when the course does; `post PPM H-2` counts days since a
 * procedure and runs indefinitely; one written for a drug stopped yesterday
 * should not move at all. Nothing in the note says which are still running.
 *
 * Bumping them uniformly produces a number that is confidently and invisibly
 * false, which is worse than the stale one it replaced — a stale counter is at
 * least the number its author last checked.
 *
 * Kept because the reminder is built on the same pattern, and because bumping
 * is the right operation when a human has said which counters to bump. It is
 * exported and tested; it is simply not called behind anyone's back.
 *
 * The surrounding text is preserved exactly — spacing, case and the separator
 * are the author's, and only the digits are a function of the date.
 */
export function bumpDayMarkers(body: string, days: number): string {
  if (days === 0) return body;
  return body.replace(MARKER, (whole, prefix: string, digits: string) => {
    const next = Number(digits) + days;
    // A counter cannot go below one: day zero of a course of antibiotics is not
    // a thing anybody writes, and a negative one is obviously nonsense on a
    // page. Reaching this means the dates ran backwards, so leave it alone.
    if (next < 1) return whole;
    return `${prefix}${String(next)}`;
  });
}

/**
 * How many days apart two clinical dates are, or `null` when that is not a
 * meaningful question.
 *
 * `IGD` is an entry id rather than a date, so an admission note has no distance
 * from anything. Returning null rather than zero keeps that distinction:
 * "do not bump" and "bump by nothing" happen to do the same thing today, and a
 * caller should not have to rely on that.
 */
export function daysBetween(from: ClinicalDate, to: ClinicalDate): number | null {
  const parse = (value: string): number | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const time = Date.parse(`${value}T00:00:00Z`);
    return Number.isNaN(time) ? null : time;
  };
  const a = parse(from);
  const b = parse(to);
  if (a === null || b === null) return null;
  return Math.round((b - a) / 86_400_000);
}
