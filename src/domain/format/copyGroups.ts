import { regionsOf } from './sectionSlices';
import type { SectionAlias, SectionId } from '../types';

/**
 * SPEC 12.4 — what actually gets copied.
 *
 * The copy sheet used to list every section the parser found, which on a real
 * handover meant a dozen chips: three dated EKGs, two lab dates, an echo, an
 * angiography report, three consultant replies. Choosing among them was slower
 * than selecting the text by hand.
 *
 * A report has five parts, so the sheet offers five.
 *
 * WHAT USED TO BE HERE, and why it is gone: a keyword table plus an
 * inheritance rule plus a positional override, all trying to answer "which
 * group does this heading belong to?" for every heading in the note. It could
 * not be made right, because a note contains headings nobody has seen before —
 * `Pulsasi:`, `6P:`, `Laporan Arteriografi (02-09-2026)` — and any rule that
 * must NAME a heading will eventually meet one it cannot name and guess.
 *
 * `sectionSlices.ts` asks a different question: where does each block BEGIN?
 * Only the five boundaries need naming, and everything between them is carried
 * along untouched. What is left here is the list of groups and the closing
 * stripper.
 */

export type CopyGroupId = 's' | 'o' | 'a' | 'terapi' | 'plan';

export interface CopyGroup {
  id: CopyGroupId;
  label: string;
  /** Section ids that always belong to this group. */
  sectionIds: readonly SectionId[];
}

export const COPY_GROUPS: readonly CopyGroup[] = [
  { id: 's', label: 'S', sectionIds: ['s'] as SectionId[] },
  {
    // Objective carries the investigations: vitals, labs, imaging, procedure
    // reports. They are read together and they are copied together.
    id: 'o',
    label: 'O + Penunjang',
    sectionIds: ['o', 'ttv', 'penunjang'] as SectionId[],
  },
  { id: 'a', label: 'A', sectionIds: ['a'] as SectionId[] },
  {
    // Consultant replies live here rather than in their own group: a reply is
    // an instruction about management, and it is read next to the drugs.
    id: 'terapi',
    label: 'Terapi + TS',
    sectionIds: ['terapi'] as SectionId[],
  },
  { id: 'plan', label: 'Plan', sectionIds: ['p'] as SectionId[] },
];

/** Groups that have any content in this body, for disabling empty chips. */
export function availableGroups(
  body: string,
  aliases: readonly SectionAlias[],
): Set<CopyGroupId> {
  /**
   * Derived from the SAME boundaries the copy is cut on.
   *
   * It used to walk the parsed sections and classify each by keyword, which is
   * a second answer to a question `sliceGroups` already answers — and two
   * answers drift. A chip could be enabled for a group that sliced to nothing,
   * or greyed out for one that had content, and either way the sheet was
   * describing a note it was not going to copy.
   */
  return new Set(regionsOf(body, aliases).map((region) => region.group));
}

/**
 * Strip a trailing closing sentence from a rendered section subset.
 *
 * The closing is not a section — it is loose text after the last heading, so
 * the parser hands it to whichever section came before it, which is Plan.
 * Copying Plan therefore ended with "Selanjutnya mohon arahan Prof. Terima
 * kasih Prof.", a sign-off pasted into the middle of a message that has not
 * finished yet.
 *
 * Matched against the user's OWN closing list rather than a pattern. These are
 * already configured — they are what the opening composer offers — and every
 * consultant is addressed differently enough ("dokter", "Prof", "dok") that a
 * regex would either miss half of them or eat a real plan item.
 *
 * Compared with punctuation and case removed, because the stored sentence is
 * the template and the note has whatever trailing full stop was typed.
 */
export function stripTrailingClosing(
  text: string,
  closings: readonly string[],
): string {
  const normalise = (value: string): string =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  const lines = text.split('\n');

  while (lines.length > 0) {
    const last = lines[lines.length - 1] ?? '';
    if (last.trim() === '') {
      lines.pop();
      continue;
    }

    const flat = normalise(last);
    // `startsWith`, not equality: the stored sentence omits the final full
    // stop that the note usually carries.
    const isClosing = closings.some((closing) => {
      const target = normalise(closing);
      return target.length > 0 && (flat === target || flat.startsWith(target));
    });
    if (!isClosing) break;
    lines.pop();
  }

  return lines.join('\n').trimEnd();
}
