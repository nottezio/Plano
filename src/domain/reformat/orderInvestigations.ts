/**
 * Ordering for the investigation blocks in a bangsal note.
 *
 * This is BLOCK-level reordering, and the distinction from the line-level
 * reordering recorded in HANDOFF §5 is the whole reason it is safe to do.
 *
 * That earlier attempt moved individual LINES, which meant deciding what each
 * line was — vitals, examination, investigation — from its wording, and every
 * wrong decision moved a finding somewhere it did not belong. This moves
 * blocks that are already labelled, and reads only the label: a block headed
 * `*Laboratorium PJT (27-08-2026)*` is a laboratory block because it says so.
 * Nothing inside a block is inspected, split, or re-ordered.
 *
 * The order is taken from two of the real note formats, which agree
 * independently — the IGD admission note and the bangsal transfer note both
 * run EKG, laboratory, chest film, cross-sectional imaging, echo, lung
 * ultrasound, conclusion.
 */

interface Block {
  /** The `*…*` heading line. */
  heading: string;
  /** Heading plus its content, ready to re-emit verbatim. */
  lines: string[];
}

/**
 * Rank by modality. Lower sorts earlier.
 *
 * Matched against the heading only. Order within this list matters where a
 * heading could match two patterns — `Echo Hemodinamik` contains "echo", and
 * `Laporan MSCT` contains neither, so each pattern is written to be specific
 * enough that the first match is the right one.
 */
const MODALITY_RANK: ReadonlyArray<readonly [RegExp, number]> = [
  [/\bEKG\b|elektrokardio/i, 1],
  [/\bLab(oratorium)?\b|\bDL\b|\bAGD\b|analisa gas/i, 2],
  [/foto\s*thorax|rontgen|\bCXR\b|\bX-?ray\b/i, 3],
  [/\bMSCT\b|\bCT\b|\bMRI\b|angiograf|calcium\s*scor/i, 4],
  [/echo|\bTTE\b|\bTEE\b/i, 5],
  [/lung\s*ultrasound|\bLUS\b|\bUSG\b/i, 6],
  [/conclusion|kesimpulan/i, 7],
];

/**
 * Anything unrecognised sorts AFTER everything named, never before and never
 * dropped.
 *
 * The recorded rule is that a transform must not discard a finding, because
 * the note still looks complete and nobody goes back to check. An unranked
 * block keeps its content and its position relative to other unranked blocks;
 * it just does not get to claim a place in the canonical run.
 */
const UNRANKED = 99;

/**
 * Is this heading an investigation block?
 *
 * Exported so the invasive-group message can pick the same blocks this
 * reorders, rather than carrying a second list of modality words that would
 * fall out of step the first time one of them was corrected.
 *
 * `Conclusion` counts: it is the tail of an echo report and travels with it.
 */
export function isInvestigationHeading(heading: string): boolean {
  return MODALITY_RANK.some(([pattern]) => pattern.test(heading));
}

function rankOf(heading: string): number {
  for (const [pattern, rank] of MODALITY_RANK) {
    if (pattern.test(heading)) return rank;
  }
  return UNRANKED;
}

/**
 * A `DD-MM-YYYY` or `DD/MM/YYYY` date inside the heading, as a sortable number.
 *
 * Returns null when the heading carries no date, which is common and not a
 * problem: those blocks keep their relative order within the modality.
 */
function dateKeyOf(heading: string): number | null {
  const match = /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(heading);
  if (!match) return null;
  const [, d, m, y] = match;
  return Number(y) * 10_000 + Number(m) * 100 + Number(d);
}

/**
 * Split a run of investigation lines into blocks.
 *
 * A block starts at a `*…*` heading and runs to the next one. Content before
 * the first heading — there should be none, but a note is free-form — is kept
 * as a leading block with no heading so it cannot be lost.
 */
function toBlocks(lines: readonly string[]): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const line of lines) {
    const isHeading = /^\s*\*.+\*\s*$/.test(line);
    if (isHeading) {
      if (current) blocks.push(current);
      current = { heading: line, lines: [line] };
      continue;
    }
    if (!current) current = { heading: '', lines: [] };
    current.lines.push(line);
  }

  if (current) blocks.push(current);
  return blocks;
}

/**
 * Reorder investigation blocks into the bangsal order.
 *
 * Stable within a rank: two EKG blocks with no dates stay in the order they
 * were written. Dated blocks inside a modality run NEWEST FIRST, which is what
 * both real formats do — the reader wants today's ECG before the one from
 * admission, and a five-day EKG run read oldest-first buries the current one.
 */
export function orderInvestigations(lines: readonly string[]): string[] {
  const blocks = toBlocks(lines);
  if (blocks.length <= 1) return [...lines];

  const decorated = blocks.map((block, index) => ({
    block,
    index,
    rank: block.heading ? rankOf(block.heading) : UNRANKED,
    date: block.heading ? dateKeyOf(block.heading) : null,
  }));

  decorated.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    // Newest first, but only between two blocks that both carry a date.
    // Comparing a dated block against an undated one by inventing a date for
    // the latter would move it for a reason that is not in the note.
    if (a.date !== null && b.date !== null && a.date !== b.date) return b.date - a.date;
    return a.index - b.index;
  });

  const out: string[] = [];
  for (const { block } of decorated) {
    if (out.length > 0) out.push('');
    out.push(...trimTrailingBlanks(block.lines));
  }
  return out;
}

function trimTrailingBlanks(lines: readonly string[]): string[] {
  const copy = [...lines];
  while (copy.length > 0 && copy[copy.length - 1]!.trim() === '') copy.pop();
  return copy;
}
