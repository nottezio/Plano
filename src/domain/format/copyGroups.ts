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
  /**
   * `saran` and `anjuran` are NOT here.
   *
   * Both are ordinary words that appear above Terapi as readily as below it —
   * an echo report ends with `Saran :`, and that is a suggestion about the
   * imaging, not a drug. Keying on them copied it into the therapy list.
   *
   * They need no keyword now: a heading below Terapi is included by position,
   * and one above it inherits the block it sits under. The words only ever
   * mattered for headings the position rule already answers.
   */
  terapi: ['terapi', 'obat', 'medikament', 'ts ', 'konsul', 'balasan'],
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
/** The headings that mark the start of the clinical note proper. */
const CLINICAL_IDS: readonly SectionId[] = ['s', 'o', 'ttv', 'penunjang', 'a', 'terapi', 'p'];

export function sectionsForGroups(
  body: string,
  aliases: readonly SectionAlias[],
  groups: readonly CopyGroupId[],
): SectionId[] {
  const wanted = new Set(groups);
  const merged = mergeSections(parseSections(body, aliases));

  /**
   * Everything before the first clinical heading is the OPENING, and no
   * section subset includes it.
   *
   * `_intro` covers the greeting only, because the identity line and the DPJP
   * lines are themselves parsed as sections — `*Ny. Siati /…*` is a wrapped
   * header and `_DPJP Kardio: …_` is a label with a value. Being unrecognised,
   * they fell through `groupForSection`'s default into `o`, so copying
   * "O + Penunjang" pasted the patient's name and three consultants above the
   * vitals.
   *
   * Cut by POSITION rather than by keyword: an opening is whatever comes
   * before the note starts, and a keyword list would need a new entry for
   * every consultant title and every way an identity line gets written.
   */
  const firstClinical = merged.findIndex((section) =>
    CLINICAL_IDS.includes(section.sectionId),
  );
  const afterOpening = firstClinical === -1 ? merged : merged.slice(firstClinical);

  /**
   * An unrecognised heading belongs to the section it sits UNDER.
   *
   * `groupForSection` ends in `return 'o'`, so any heading it cannot name
   * lands in O no matter where it appears. `Selesai :` — the completed-therapy
   * list that sits after the drugs and before `*Plan:*` — was therefore copied
   * with the vitals. It is not an observation; it is the tail of the therapy
   * block, and the note says so by putting it there.
   *
   * A keyword for `selesai` would fix this one heading and leave the next one
   * broken. Position is the property that generalises: a heading with no
   * recognised name continues whatever section it follows, which is exactly
   * how it reads on the page.
   *
   * The opening cut above is the same principle applied to the other end.
   */
  let carried: CopyGroupId | null = null;
  const grouped = afterOpening.map((section) => {
    const named = CLINICAL_IDS.includes(section.sectionId)
      ? groupForSection(section.sectionId, section.label)
      : null;

    if (named) {
      carried = named;
      return { section, group: named };
    }

    // A keyword match still wins over inheritance — `*EKG …*` under Terapi is
    // an investigation wherever it was typed.
    const byKeyword = groupForSection(section.sectionId, section.label);
    const inherited: CopyGroupId = carried ?? byKeyword;
    // `byKeyword === 'o'` is the default talking, not a match, so that is the
    // only case where inheritance takes over.
    const group = byKeyword === 'o' ? inherited : byKeyword;

    /**
     * A `*TS …*` heading RESETS what following headings inherit.
     *
     * Everything a consulting service writes under its own heading — its `A/`,
     * `P/`, `I/` — is unnamed, so it inherited whatever our note was carrying.
     * When the TS block sat after our `*Plan:*`, that meant copying Plan also
     * pasted the orthopaedic team's plan and instructions as if they were ours.
     *
     * A TS block belongs with Terapi (see COPY_GROUPS: "Terapi + TS", a reply
     * is an instruction about management). Carrying `terapi` forward from the
     * heading keeps its whole block together and, more importantly, stops our
     * Plan from absorbing it.
     */
    if (group === 'terapi') carried = 'terapi';

    return { section, group };
  });

  /**
   * "Terapi + TS" is everything from the Terapi heading DOWN, minus Plan.
   *
   * Positional, not keyword. `saran` is a therapy keyword, so a `Saran :`
   * inside an echo report — a suggestion about the imaging, sitting in O —
   * was copied into the therapy list. `anjuran`, `konsul` and `balasan` have
   * the same exposure: they are ordinary words that appear above Terapi as
   * easily as below it.
   *
   * Where a heading SITS answers this without guessing. Therapy is the last
   * clinical block of the note, and everything after it — the TS replies, the
   * completed-therapy list, the consulting services' own instructions —
   * belongs with it. Plan is the one thing after Terapi that has its own chip,
   * so it is the one thing excluded.
   *
   * Falls back to the keyword grouping when the note has no Terapi heading at
   * all, which is the case for a note still being written.
   */
  if (wanted.has('terapi')) {
    const start = grouped.findIndex(({ section }) => section.sectionId === 'terapi');
    if (start !== -1) {
      const tail = grouped
        .slice(start)
        .filter(({ section }) => section.sectionId !== 'p')
        .map(({ section }) => section.sectionId);

      // Other chips selected alongside Terapi keep their own grouping.
      const others = grouped
        .filter(({ group }) => wanted.has(group) && group !== 'terapi')
        .map(({ section }) => section.sectionId);

      return [...new Set([...others, ...tail])];
    }
  }

  return grouped
    // Empty sections are kept for the same reason composeCopy keeps them: a
    // dated heading whose values parse as their own sections is empty, and its
    // date is the part that matters.
    .filter(({ section }) => section.sectionId !== '_intro')
    .filter(({ group }) => wanted.has(group))
    .map(({ section }) => section.sectionId);
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
