import { parseSections, type ParsedSection } from './parseSections';
import type { SectionAlias, SectionId } from '../types';

export interface JumpTarget {
  sectionId: SectionId | '_identity';
  /** Short label for the button. */
  label: string;
  /** DOM id to scroll to, or null for the page top. */
  anchorId: string | null;
}

/**
 * The order jump buttons appear in.
 *
 * Fixed, NOT the order the sections happen to appear in the note.
 *
 * A note whose author typed Terapi above A would otherwise reorder the buttons
 * under the thumb, and a navigation control whose positions move is one you
 * have to read every time instead of learning once. The note is free-form on
 * purpose; the index over it should not be.
 *
 * `ttv` and `penunjang` are deliberately absent even though the parser knows
 * them: they sit inside O in every note in the corpus, so a button for them
 * would land within a screen of the O button and buy nothing for the width it
 * costs. Custom sections are absent for the same reason plus a worse one —
 * there can be any number of them.
 */
const ORDER: readonly SectionId[] = ['s', 'o', 'a', 'terapi', 'p'];

/*
 * The `SHORTHAND` map that lived here — `a` -> `custom_a`, `p` -> `custom_p`
 * — has been REMOVED.
 *
 * It was added from one screenshot showing `*A/*` and `*P/*` in a note, on the
 * reading that those were this note's own headings. They are not: `A/` and
 * `P/` are the TS convention, written by a consulting service inside its own
 * block. Mapping them made the A and Plan buttons jump to another service's
 * assessment whenever this note's own sections were written in the usual prose
 * form — which is always.
 *
 * The prose headings are now recognised properly by `classifyProseHeader`, so
 * `a`, `terapi` and `p` resolve on their own and need no fallback.
 */

/**
 * Fallback labels, used when the note's own token is missing or too wide for a
 * button. Keyed to the section, so the fallback is still the word the note
 * would have used in its short form.
 */
const SHORT: Record<string, string> = {
  s: 'S',
  o: 'O',
  a: 'A',
  terapi: 'Terapi',
  p: 'Plan',
};

/**
 * The token the NOTE uses for this header, stripped of decoration.
 *
 * `"*S :*"` -> `"S"`, `"*Terapi :*"` -> `"Terapi"`, `"- Penunjang: "` ->
 * `"Penunjang"`.
 *
 * The label comes from the body rather than from the alias table on purpose.
 * The first version used `labelFor` with a length cutoff, and the default
 * labels straddled it — "Subjektif" is 9 characters and "Objektif" is 8 — so
 * the bar rendered "S" next to "Objektif" for two sections written identically
 * in the note. An arbitrary threshold was deciding a semantic question.
 *
 * Reading the token instead makes the button say what you will land on. It is
 * also self-maintaining: rename a section in settings, write the new word in a
 * note, and the button follows without this file knowing anything about it.
 */
const MAX_LABEL = 10;

export function headerToken(headerLine: string | null): string | null {
  if (!headerLine) return null;
  const token = headerLine
    // Leading decoration and list markers.
    .replace(/^[\s*_~-]+/, '')
    // Trailing delimiter, decoration and spacing. The delimiter may sit inside
    // the emphasis (`*S :*`) or outside it (`*S*:`), so both are stripped.
    .replace(/[\s*_~:/]+$/, '')
    .trim();
  return token.length > 0 ? token : null;
}

/**
 * Which jump buttons to show for a given body.
 *
 * EXACTLY six, and only the ones this note actually has: identity, S, O, A,
 * Terapi, Plan.
 *
 * A previous version offered every heading the parser found, on the reasoning
 * that navigation should not depend on the alias table classifying a heading.
 * That produced a bar of `tn udis 0…`, `ekg pjt l…`, `ekg hcu p…` — the lab
 * and EKG blocks — burying the five destinations that are used constantly. The
 * principle was right and the conclusion was wrong: the fix for an
 * unrecognised heading is to recognise it, not to widen the bar. See
 * `SHORTHAND` above and the `T/` alias in defaults.ts.
 *
 * A `*TS BTKV*` block's own S/O/A/P are never targets, because first
 * occurrence wins and the note's own sections are written above the block that
 * answers them.
 *
 * Identity is always present because it is not part of the body at all: it is
 * the sticky header, so its target is the top of the page.
 */
export function jumpTargets(
  body: string,
  aliases: readonly SectionAlias[],
): JumpTarget[] {
  // First occurrence wins, matching the anchor rule in SectionBands: a note
  // carries three EKG blocks, and "jump to O" means the first one.
  const present = new Map<SectionId, ParsedSection>();
  for (const section of parseSections(body, aliases)) {
    if (!present.has(section.sectionId)) present.set(section.sectionId, section);
  }

  const targets: JumpTarget[] = [
    { sectionId: '_identity', label: 'Identitas', anchorId: null },
  ];

  for (const id of ORDER) {
    const section = present.get(id);
    if (!section) continue;
    const token = headerToken(section.headerLine);
    /**
     * A long token falls back to the canonical short form.
     *
     * The corpus headers are not all short: `a` and `terapi` are routinely
     * written "Mohon izin kami assess dengan" and "Mohon izin kami terapi
     * dengan", and a 29-character button is not an index.
     *
     * This is NOT the arbitrary cutoff that was here before. That one compared
     * ALIAS TABLE labels, where "Subjektif" (9) and "Objektif" (8) straddled
     * the threshold and produced "S" beside "Objektif" for two headers written
     * identically in the note. This compares the note's own token against a
     * width the button can actually render, and every ordinary heading — "S",
     * "O", "A", "Terapi", "Plan", "Subjektif" — sits comfortably under it, so
     * the mixed-form result cannot recur.
     */
    const label =
      token && token.length <= MAX_LABEL ? token : (SHORT[id] ?? id.toUpperCase());
    targets.push({
      sectionId: id,
      label,
      anchorId: `sec-${id}`,
    });
  }

  return targets;
}
