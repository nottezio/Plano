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
}

export function findDayMarkers(body: string): DayMarker[] {
  return [...body.matchAll(MARKER)].map((match) => ({
    text: match[0],
    value: Number(match[2]),
  }));
}

/**
 * Advance every day counter by `days`.
 *
 * Applied uniformly rather than per-marker, because every counter in a note
 * measures from a different start but ALL of them advance at the same rate.
 * Three days since the last note moves `H-2` to `H-5` and `hari ke-9` to
 * `hari ke-12`, and no counter is exempt.
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
