import type { SectionId } from '../types';

/**
 * Classify a heading the exact-token alias table could not match.
 *
 * The corpus writes its assessment and therapy headings as sentences, and
 * spells them inconsistently:
 *
 *   *Mohon izin kami assess dengan:*
 *   *Mohon izin kami assest dengan:*
 *   *Mohon izin kami assesst dengan :*
 *   *Mohon izin kami terapi dengan*        <- no delimiter at all
 *
 * `buildMatcher` matches whole tokens against a lowercased map, so each of
 * those spellings is a separate string and only the ones written down are
 * found. Adding the four seen so far would work until the fifth typo, which is
 * the failure mode already recorded for the SIMGOS character list and the
 * ASCII fold: an explicit list is always one behind the next real note.
 *
 * So this matches a STEM, and it runs only on headings that were going to
 * become `custom_*` anyway — it cannot change a heading the alias table
 * already resolves, so it cannot regress existing notes.
 *
 * Deliberately NOT handling `A/` and `P/`. Those are the TS convention: a
 * `*TS BTKV*` block writes its own assessment and plan that way, and this
 * note's own sections never do. Classifying them would point copy, tinting and
 * the jump bar at a consulting service's assessment instead of ours.
 */

/**
 * `as+e?s+` covers assess, asses, assest, assesst, assessment, asessment.
 *
 * Built from the doubling that actually varies — the `ss` and the `e` — rather
 * than from a list of the spellings seen so far.
 */
const ASSESS = /as+e?s+/;
const TERAPI = /terapi|therapy|tatalaksana/;

/*
 * Only assessment and therapy.
 *
 * A first draft also carried stems for plan, subjective and objective. They
 * were unnecessary and therefore purely a source of false positives: `*S:*`,
 * `*O :*` and `*Plan*` are all matched by the alias table already, in every
 * one of the three note formats. `rencana` in particular would have claimed
 * `*Rencana tindak lanjut bersama tim bedah:*` — a TS heading — as this note's
 * plan.
 *
 * These two are here because they are the two that actually fail, and they
 * fail for a specific reason: they are the only headings written as sentences
 * with a word whose spelling varies.
 */

/**
 * A heading only counts if the stem is what the heading is ABOUT.
 *
 * Two ways to qualify:
 *
 *  1. It opens with "mohon izin" — the sentence form the corpus always uses.
 *  2. The stem is the heading's FIRST word.
 *
 * Rule 2 started as "three words or fewer", which let `Riwayat terapi
 * sebelumnya` through as the therapy section — a history heading, so a past
 * medication list would have been pulled into the plan sent to the DPJP. A
 * length cap was measuring the wrong thing: `Riwayat terapi` is short and
 * still about history. A heading names its own section first, and anything
 * before the stem is qualifying it into something else.
 */
function stemIsFirstWord(normalised: string, stem: RegExp): boolean {
  const first = normalised.split(' ')[0] ?? '';
  return stem.test(first);
}

export function classifyProseHeader(label: string): SectionId | null {
  const normalised = label
    .toLowerCase()
    // Punctuation and emphasis carry no meaning here; `assess:` and `assess`
    // must land in the same place.
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalised) return null;

  const opensWithRequest = /^(mohon izin|izin|kami mohon)/.test(normalised);

  // Order matters: a heading naming two sections resolves by intent rather
  // than by position in this list. Assessment first because it is the one with
  // spelling variance, and therefore the one most likely to arrive here.
  const STEMS: ReadonlyArray<readonly [RegExp, SectionId]> = [
    [ASSESS, 'a'],
    [TERAPI, 'terapi'],
  ];

  for (const [stem, sectionId] of STEMS) {
    if (!stem.test(normalised)) continue;
    if (opensWithRequest || stemIsFirstWord(normalised, stem)) return sectionId;
  }

  return null;
}
