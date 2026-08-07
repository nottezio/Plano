import { mergeSections, parseSections } from '../sections/parseSections';
import type { SectionAlias, SectionId } from '../types';

/**
 * SPEC 12.4 — what actually gets copied.
 *
 * The copy sheet used to list every section the parser found, which on a real
 * handover meant a dozen chips: three dated EKGs, two lab dates, an echo, an
 * angiography report, three consultant replies. Choosing among them was slower
 * than selecting the text by hand.
 *
 * A report has five parts, so the sheet offers five. Everything the parser
 * finds is routed into one of them — including sections nobody predicted,
 * because a group defined only by an explicit list would silently drop the
 * heading someone invents next week, and dropping clinical text from a copy is
 * the one failure this must not have.
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

/** Words that place an unrecognised heading into a group. */
const KEYWORDS: Record<CopyGroupId, readonly string[]> = {
  s: ['keluhan', 'subjektif', 'anamnesis'],
  o: [
    'ekg',
    'lab',
    'penunjang',
    'foto',
    'thorax',
    'echo',
    'ct',
    'mri',
    'usg',
    'rontgen',
    'angiograf',
    'laporan',
    'pemeriksaan',
    'objektif',
    'ttv',
    'tanda vital',
  ],
  a: ['assess', 'diagnos', 'problem', 'masalah'],
  terapi: ['terapi', 'obat', 'medikament', 'ts ', 'konsul', 'balasan', 'anjuran', 'saran'],
  plan: ['plan', 'rencana', 'monitor', 'edukasi'],
};

/**
 * Which group an arbitrary section belongs to.
 *
 * Known ids match first. Unknown ones are placed by keyword, and anything still
 * unplaced falls to `o` — the objective block is where free-standing findings
 * belong, and a wrong-but-included section is recoverable by editing the paste
 * while an omitted one is not noticed at all.
 */
export function groupForSection(
  sectionId: SectionId,
  label: string,
): CopyGroupId {
  for (const group of COPY_GROUPS) {
    if (group.sectionIds.includes(sectionId)) return group.id;
  }

  const haystack = `${sectionId} ${label}`.toLowerCase();
  for (const group of COPY_GROUPS) {
    if (KEYWORDS[group.id].some((keyword) => haystack.includes(keyword))) return group.id;
  }

  return 'o';
}

/**
 * Expands the chosen groups into the concrete section ids present in a body.
 *
 * `_intro` is deliberately excluded: it holds the greeting, identity line and
 * DPJP line, which the whole-note copy already carries and a section subset
 * should not duplicate.
 */
export function sectionsForGroups(
  body: string,
  aliases: readonly SectionAlias[],
  groups: readonly CopyGroupId[],
): SectionId[] {
  const wanted = new Set(groups);

  return mergeSections(parseSections(body, aliases))
    // Empty sections are kept for the same reason composeCopy keeps them: a
    // dated heading whose values parse as their own sections is empty, and its
    // date is the part that matters.
    .filter((section) => section.sectionId !== '_intro')
    .filter((section) => wanted.has(groupForSection(section.sectionId, section.label)))
    .map((section) => section.sectionId);
}

/** Groups that have any content in this body, for disabling empty chips. */
export function availableGroups(
  body: string,
  aliases: readonly SectionAlias[],
): Set<CopyGroupId> {
  const present = new Set<CopyGroupId>();

  for (const section of mergeSections(parseSections(body, aliases))) {
    if (section.sectionId === '_intro') continue;
    present.add(groupForSection(section.sectionId, section.label));
  }

  return present;
}
