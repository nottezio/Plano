import { labelFor } from './aliases';
import { parseSections } from './parseSections';
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
 * Short labels, because these are buttons in a scrolling row on a phone.
 *
 * Not taken from `labelFor` alone: a user's alias for `p` may be "Plan &
 * Monitoring", which is correct in the note and far too wide here. The alias
 * still wins when it is short enough, so someone who renamed a section still
 * recognises their own wording.
 */
const SHORT: Record<string, string> = {
  s: 'S',
  o: 'O',
  a: 'A',
  terapi: 'Terapi',
  p: 'Plan',
};

const MAX_LABEL = 8;

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
  const present = new Set<SectionId>();
  for (const section of parseSections(body, aliases)) {
    present.add(section.sectionId);
  }

  const targets: JumpTarget[] = [
    { sectionId: '_identity', label: 'Identitas', anchorId: null },
  ];

  for (const id of ORDER) {
    if (!present.has(id)) continue;
    const alias = labelFor(id, aliases);
    const label =
      alias && alias.length <= MAX_LABEL ? alias : (SHORT[id] ?? id.toUpperCase());
    targets.push({ sectionId: id, label, anchorId: `sec-${id}` });
  }

  return targets;
}
