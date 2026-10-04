import { parseSections } from './sections/parseSections';
import type { SectionAlias } from './types';

/**
 * "Penunjang terbaru saja": keep only the newest dated block of each kind of
 * investigation.
 *
 * Some consultants (dr. AHA) want the report to carry the latest EKG, the
 * latest lab, the latest thorax, not the stack the note accumulates. The stack
 * is deliberately carried forward every morning (see `carryForward`: clearing
 * penunjang would delete the history that is the point of carrying), so the
 * trimming happens on a COPY: a SOAP version, or the text Salin produces. The
 * day's own SOAP is never touched.
 *
 * WHAT IS A BLOCK. A heading line carrying a date in parentheses —
 * `*EKG di PJT Lt. 4 (31-8-2026)*`, `*Laboratorium PJT (02-10-2026)*`,
 * `Laporan PTCA di PJT (16-09-2026)` — and everything under it up to the next
 * such heading, the next own-line bold heading, or the next S/O/TTV/A/Terapi/
 * Plan heading. Undated investigations are never removed: without a date
 * there is no "older".
 *
 * WHERE. Only above the assessment. Below it, a dated line is a plan
 * (`Rencana Echo (06-10-2026)`), not a result, and removing it would delete a
 * decision.
 *
 * WHICH KIND. From the heading with the place and the date stripped, so
 * `Laboratorium IGD` and `Laboratorium PJT` are both `lab`, and `EKG di CVCU`
 * and `EKG PJT Lt. 4` are both `ekg`. Kinds nobody listed (a culture, a
 * specific procedure report) are compared by their own words, so two
 * `Kultur Darah` blocks still collapse to the newest.
 *
 * Every block on the newest date of its kind is kept, so two draws on the
 * same day both stay.
 *
 * Failure direction, chosen: a boundary found too EARLY leaves the old
 * block's tail in place (visible, harmless); one found too late would delete
 * lines that are not part of it. So a block ends at the first thing that
 * could be a heading.
 */

export interface RemovedBlock {
  kind: string;
  /** The heading line as written, trimmed. */
  heading: string;
  /** ISO date of the removed block. */
  date: string;
}

export interface TrimResult {
  text: string;
  removed: RemovedBlock[];
}

const HEADING_RE =
  /^[ \t]*[*_]*[ \t]*([^\n()\-–•*_0-9][^\n()]{0,60}?)[ \t]*\((\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\)[ \t]*[*_:]*[ \t]*$/;

const BOLD_LINE_RE = /^[ \t]*(?:\*[^*\n]{1,90}\*|_[^_\n]{1,90}_)[ \t]*:?[ \t]*$/;

const PLACE_WORDS = new Set([
  'di', 'pjt', 'igd', 'ugd', 'cvcu', 'hcu', 'icu', 'iccu', 'lt', 'lantai', 'perawatan',
  'rsws', 'uh', 'poli', 'bangsal', 'rs', 'ruang', 'ruangan', 'cathlab',
]);

/** Spellings of one kind, most specific first. */
const KINDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^(?:ekg|ecg|elektrokardiogra\w*)\b/, 'ekg'],
  [/^(?:echo|echocardiogra\w*|ekokardiogra\w*) hemodinamik\b/, 'echo hemodinamik'],
  [/^(?:echo|echocardiogra\w*|ekokardiogra\w*)\b/, 'echo'],
  [/^(?:lab|laboratorium)\b/, 'lab'],
  [/^(?:urinalisa|urinalisis)\b/, 'urinalisa'],
  [/^(?:agd|analisa gas darah|analisis gas darah)\b/, 'agd'],
  [/^(?:foto |rontgen |x-?ray )?(?:thorax|thoraks|toraks)\b/, 'thorax'],
  [/^(?:lus|lung ultrasound)\b/, 'lus'],
];

/** The kind of investigation a heading names; '' when nothing is left. */
export function penunjangKind(label: string): string {
  const words = label
    .toLowerCase()
    .replace(/[*_:]/g, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/\.$/, ''))
    .filter((word) => word && !PLACE_WORDS.has(word) && !/^\d+$/.test(word));
  const key = words.join(' ');
  for (const [pattern, kind] of KINDS) if (pattern.test(key)) return kind;
  return key;
}

function isoDate(day: string, month: string, year: string): string | null {
  const d = Number(day);
  const m = Number(month);
  const y = year.length === 2 ? 2000 + Number(year) : Number(year);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

interface Block {
  start: number;
  end: number;
  kind: string;
  date: string;
  heading: string;
}

const CORE = new Set(['s', 'o', 'ttv', 'a', 'p', 'terapi']);
const BELOW = new Set(['a', 'p', 'terapi']);

/**
 * Every dated investigation block above the assessment, in note order.
 * Shared by "penunjang terbaru saja" and by where a new lab block is inserted,
 * so the two can never disagree about what a block is.
 */
export function penunjangBlocks(
  body: string,
  aliases?: readonly SectionAlias[],
): Array<{ start: number; end: number; kind: string; date: string; heading: string }> {
  const sections = parseSections(body, aliases);
  const cutoff =
    sections.find((section) => BELOW.has(section.sectionId) && section.ownsLine)?.start ??
    body.length;
  const coreStarts = new Set(
    sections
      .filter((section) => CORE.has(section.sectionId) && section.ownsLine)
      .map((section) => section.start),
  );

  // Lines before the cutoff, with their offsets.
  const lines: Array<{ start: number; text: string }> = [];
  for (let from = 0; from < cutoff; ) {
    const newline = body.indexOf('\n', from);
    const end = newline < 0 || newline > cutoff ? cutoff : newline;
    lines.push({ start: from, text: body.slice(from, end) });
    if (newline < 0 || newline >= cutoff) break;
    from = newline + 1;
  }

  const blocks: Block[] = [];
  let open: Omit<Block, 'end'> | null = null;
  const close = (at: number): void => {
    if (open) blocks.push({ ...open, end: at });
    open = null;
  };

  for (const line of lines) {
    const heading = HEADING_RE.exec(line.text);
    const date = heading ? isoDate(heading[2]!, heading[3]!, heading[4]!) : null;
    const kind = heading ? penunjangKind(heading[1]!) : '';
    if (heading && date && kind) {
      close(line.start);
      open = { start: line.start, kind, date, heading: line.text.trim() };
      continue;
    }
    if (open && (coreStarts.has(line.start) || BOLD_LINE_RE.test(line.text))) close(line.start);
  }
  close(cutoff);
  return blocks;
}

export function latestPenunjangOnly(
  body: string,
  aliases?: readonly SectionAlias[],
): TrimResult {
  const blocks = penunjangBlocks(body, aliases);

  const newest = new Map<string, string>();
  for (const block of blocks) {
    const seen = newest.get(block.kind);
    if (!seen || block.date > seen) newest.set(block.kind, block.date);
  }
  const drop = blocks.filter((block) => block.date < (newest.get(block.kind) ?? block.date));
  if (drop.length === 0) return { text: body, removed: [] };

  let text = '';
  let from = 0;
  for (const block of drop) {
    text += body.slice(from, block.start);
    from = block.end;
  }
  text += body.slice(from);

  return {
    text,
    removed: drop.map((block) => ({ kind: block.kind, heading: block.heading, date: block.date })),
  };
}
