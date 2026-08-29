import { parseSections, type ParsedSection } from './parseSections';
import type { SectionAlias, SectionId } from '../types';

export interface JumpTarget {
  sectionId: SectionId | '_identity';
  /** Short label for the button. */
  label: string;
  /** DOM id to scroll to, or null for the page top. */
  anchorId: string | null;
  /**
   * True when the alias table did not recognise this header.
   *
   * Rendered muted rather than hidden. See `jumpTargets` for why these are
   * offered at all.
   */
  unrecognised: boolean;
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

/**
 * Does this header occupy its own line, or does it label a value on it?
 *
 * The parser recognises `Label : value` as a section start, which is correct
 * for its own purposes — it is how `Penunjang: Hb 12` gets grouped. But it
 * means every vitals line in O (`Tekanan Darah : 121/84 mmHg`, `Nadi : 73
 * x/menit`) is technically a section, and offering each one a jump chip buries
 * the five that matter under a row of them.
 *
 * A HEADING owns its line: the text after the delimiter is a newline, and the
 * content lives below. A FIELD shares its line with its value. That is the
 * real distinction, and it is structural rather than a list of vitals names
 * that would be one behind the next thing someone writes.
 */
function ownsItsLine(body: string, start: number, headerLine: string | null): boolean {
  if (!headerLine) return false;
  const after = body.slice(start + headerLine.length);
  return after.length === 0 || after.startsWith('\n');
}

/** Last resort for a custom id with an unusable header token. */
function shorten(id: string): string {
  const bare = id.replace(/^custom_/, '').replace(/_/g, ' ');
  return bare.length <= MAX_LABEL ? bare : `${bare.slice(0, MAX_LABEL - 1)}…`;
}

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
 * EVERY header the parser found gets a button — including ones the alias table
 * could not classify.
 *
 * The first version offered only the five known ids, which made navigation
 * depend on semantic recognition. Those are different jobs. The alias table
 * decides what a section MEANS, which is what tinting and copy grouping need.
 * A jump needs only where it IS, and a header the parser located has a
 * position whether or not anything can name it. Gating the second on the first
 * meant a note whose "Assessment" or "Terapi" heading is worded in some way
 * the table does not list — and the table cannot list them all, that is why
 * `custom_` exists — silently lost its buttons, with no way to tell that from
 * the section simply being absent.
 *
 * Known sections come first in fixed canonical order so the five you reach for
 * constantly do not move under your thumb. Unrecognised ones follow in
 * first-appearance order, muted, because there is no canonical position to
 * give them and inventing one would reorder against the note.
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
    { sectionId: '_identity', label: 'Identitas', anchorId: null, unrecognised: false },
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
    targets.push({ sectionId: id, label, anchorId: `sec-${id}`, unrecognised: false });
  }

  /**
   * Everything else the parser found, in the order it appears.
   *
   * `_intro` is skipped — it is the text before any heading, which is where
   * "Identitas" already lands. `ttv` and `penunjang` are included here rather
   * than in ORDER: they sit inside O in the corpus, so they do not deserve a
   * fixed slot, but they are still real headings a long note may want to reach.
   */
  for (const [id, section] of present) {
    if (id === '_intro') continue;
    if (ORDER.includes(id)) continue;
    if (!ownsItsLine(body, section.start, section.headerLine)) continue;
    const token = headerToken(section.headerLine);
    targets.push({
      sectionId: id,
      label: token && token.length <= MAX_LABEL ? token : (SHORT[id] ?? shorten(id)),
      anchorId: `sec-${id}`,
      unrecognised: true,
    });
  }

  return targets;
}
