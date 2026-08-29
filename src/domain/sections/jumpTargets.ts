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

/**
 * Fallback labels, used only when a header token cannot be recovered.
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
 * Only sections that ACTUALLY EXIST in this note get a button. A fixed row of
 * six that scrolls to nothing for four of them teaches you to distrust the
 * whole row; a row that shrinks tells you something true about the note — that
 * it has no A yet.
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
    const label = headerToken(section.headerLine) ?? SHORT[id] ?? id.toUpperCase();
    targets.push({ sectionId: id, label, anchorId: `sec-${id}` });
  }

  return targets;
}
