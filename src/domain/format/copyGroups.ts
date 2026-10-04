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
 * The sign-off, recognised by what it IS, not only by the configured list.
 *
 * ROOT CAUSE (2026-10-05, Avi: section-only copies still ended with "Tabe
 * terima kasih dokter"). Recognition used ONLY the closing sentences stored
 * in Settings. The notes are written by hand and by colleagues, so the
 * closing in a real note is very often not one of the stored templates —
 * "Tabe terima kasih dokter", "Mohon arahannya dokter. Terima kasih dokter." —
 * and anything not in the list sailed through into every Plan-only copy.
 *
 * The earlier objection to a pattern was that it would "eat a real plan
 * item". That is answered by what a sign-off always has and a plan item never
 * has together:
 *  - a sign-off phrase (terima kasih / mohon arahan(nya) / mohon bimbingan /
 *    wassalam), AND
 *  - an addressee (dokter, dok, Prof, dr, chief…), AND
 *  - it is NOT a list item (`- `, `• `, `1. `) — plan items are, and
 *  - it is not the opening ("…mohon izin melaporkan…").
 * The configured list still counts, for closings that break that shape.
 */
const SIGN_OFF = /\b(terima\s*kasih|mohon\s+(arahan|arahannya|bimbingan|bimbingannya)|wassalam\w*)\b/i;
const ADDRESSEE = /\b(dokter|dok|prof|profesor|dr|chief|konsulen|senior|kak|kakak)\b/i;
const LIST_ITEM = /^\s*[*_]*\s*([-•]|\d+[.)])\s/;

export function isClosingLine(line: string, closings: readonly string[] = []): boolean {
  const text = line.trim();
  if (!text || text.length > 220) return false;
  if (LIST_ITEM.test(text)) return false;
  const normalise = (value: string): string =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const flat = normalise(text);
  // `startsWith`, not equality: the stored sentence omits the final full stop
  // that the note usually carries.
  const configured = closings.some((closing) => {
    const target = normalise(closing);
    return target.length > 0 && (flat === target || flat.startsWith(target));
  });
  if (configured) return true;
  return SIGN_OFF.test(text) && ADDRESSEE.test(text) && !/melaporkan/i.test(text);
}

/**
 * Remove the sign-off from a rendered section SUBSET.
 *
 * The closing is not a section — it is loose text after the last heading, so
 * the parser hands it to whichever section came before it (Plan, or a TS
 * block). Copying Plan therefore ended with a sign-off pasted into the middle
 * of a message that has not finished yet. Removed wherever it stands as its
 * own line, not only at the very end, because a TS block written after the
 * closing used to keep it in the middle of a "Terapi + TS" copy.
 *
 * The whole-note copy never calls this: there the closing ends the message
 * and belongs.
 */
export function stripTrailingClosing(
  text: string,
  closings: readonly string[],
): string {
  const kept = text.split('\n').filter((line) => !isClosingLine(line, closings));
  // A removed line in the middle can leave three newlines in a row.
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}
