import { parseSections } from '../sections/parseSections';
import type { SectionAlias, SectionId } from '../types';
import type { CopyGroupId } from './copyGroups';

/**
 * "Salin bagian", by BOUNDARY rather than by recognition.
 *
 * WHAT WAS WRONG WITH RECOGNITION
 *
 * The previous approach asked, of every heading in the note, "which of the five
 * groups does this one belong to?" — by id, then by keyword, then by what it
 * sat under, then by a positional override for Terapi, then by a reset rule for
 * TS blocks. Each of those was added to fix a real note, and each was correct
 * about the note that prompted it.
 *
 * It cannot be made right, because it is answering the wrong question. A note
 * contains headings nobody has seen before — `Pulsasi:`, `Status vaskuler
 * ekstremitas inferior:`, `6P:`, `Laporan Arteriografi (02-09-2026)` — and any
 * rule that must NAME a heading to place it will meet one it cannot name and
 * guess. When it guessed wrong, the vascular findings were copied under
 * `*Diagnosis:*` in a document going to a consultant.
 *
 * WHAT REPLACES IT
 *
 * A section is the text BETWEEN two boundaries. To copy O, take everything from
 * the `*O:*` heading down to the next boundary — and never mind what is in
 * between, because whatever it is, the author put it under O and that is where
 * it belongs.
 *
 * Nothing has to be recognised except the boundaries themselves, and those are
 * the handful of headings every note in the corpus has. An unfamiliar heading
 * needs no rule at all: it is carried along inside whichever block contains it,
 * which is the same thing a reader does.
 *
 * The text is also CONTIGUOUS and taken from the original, so what is copied is
 * what was written — same order, same spacing, same wording. The old path
 * reassembled the note from parsed pieces, sorted them by a canonical section
 * order and dropped what did not match, which is how content moved and went
 * missing.
 */

/**
 * The headings that end one block and begin the next.
 *
 * Ordered as a note is ordered, but the order is documentation — the boundaries
 * are found in the sequence the note actually uses, because a note that puts
 * Terapi before A is unusual, not wrong.
 */
const BOUNDARY_GROUP: Partial<Record<SectionId, CopyGroupId>> = {
  s: 's',
  o: 'o',
  a: 'a',
  terapi: 'terapi',
  p: 'plan',
};

/**
 * `ttv` and `penunjang` are NOT boundaries.
 *
 * They are objective findings — vitals, labs, EKGs, imaging, procedure reports
 * — and they belong inside O, which is where the note puts them and where they
 * are read. Treating a `*Laboratorium PJT (05-09-2026)*` heading as a boundary
 * would cut the objective block into a dozen fragments and force each one to be
 * placed by name again, which is the problem this exists to remove.
 */
const CONSULT_HEADING = /^\s*[*_]*\s*TS\b/;

export interface Region {
  group: CopyGroupId;
  start: number;
  end: number;
}

/**
 * Cut the body into labelled regions.
 *
 * Everything before the first boundary is the OPENING — greeting, reporting
 * sentence, identity line, DPJP lines — and belongs to no group, so a section
 * subset never carries it. That falls out of the shape rather than needing a
 * rule: the opening is simply the text before the note starts.
 */
export function regionsOf(
  body: string,
  aliases: readonly SectionAlias[],
): Region[] {
  const sections = parseSections(body, aliases);
  const starts: Array<{ group: CopyGroupId; start: number }> = [];

  for (const section of sections) {
    if (section.headerLine === null) continue;

    /**
     * A `TS …` heading is a boundary, and it belongs with Terapi.
     *
     * It has to be one: the consulting services write at the END of the note,
     * after `*Plan:*`, so without a boundary there the Plan block would run to
     * the bottom and copying Plan would paste the anaesthetist's plan and the
     * endocrinologist's insulin orders as if they were ours.
     *
     * Grouped with Terapi because a reply is an instruction about management
     * and is read beside the drugs — unchanged from before.
     */
    if (CONSULT_HEADING.test(section.headerLine)) {
      starts.push({ group: 'terapi', start: section.start });
      continue;
    }

    /**
     * A boundary heading opens a block whether or not it owns its line.
     *
     * `S: Sesak berkurang` is as much the start of the subjective block as a
     * bare `*S:*` on its own line, and both shapes are in the corpus.
     *
     * There is no need to exclude fields here: only the five boundary ids can
     * open a block, and `Tekanan Darah : 135/76` parses as a custom section,
     * not as one of them. Requiring `ownsLine` would only have dropped the
     * inline form.
     */
    const group = BOUNDARY_GROUP[section.sectionId];
    if (group) starts.push({ group, start: section.start });
  }

  return starts.map((entry, index) => ({
    group: entry.group,
    start: entry.start,
    end: starts[index + 1]?.start ?? body.length,
  }));
}

/**
 * The chosen groups, as one contiguous piece of the original note.
 *
 * Regions stay in DOCUMENT order rather than being sorted into a canonical
 * S-O-A-P sequence. If the author wrote Terapi above A, copying both should
 * hand back what they wrote — reordering it silently asserts that the note was
 * wrong, in a message they are about to send.
 */
export function sliceGroups(
  body: string,
  aliases: readonly SectionAlias[],
  groups: readonly CopyGroupId[],
): string {
  const wanted = new Set(groups);
  const chosen = regionsOf(body, aliases).filter((region) => wanted.has(region.group));

  return chosen
    .map((region) => body.slice(region.start, region.end).trimEnd())
    .filter((chunk) => chunk.trim().length > 0)
    .join('\n\n')
    .trim();
}
