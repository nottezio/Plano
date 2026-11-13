import { stripReportFrame } from '@/domain/floorList/build';
import { toPlain } from '@/domain/format/formatters';
import { matchInvestigationHeading } from '@/domain/sections/investigationHeading';
import { parseSections } from '@/domain/sections/parseSections';
import type { SectionAlias, SectionId } from '@/domain/types';

/**
 * One day's SOAP split into the two text columns of the reference slide:
 * "Anamnesis dan Pemeriksaan Fisik" and "Diagnosis dan Terapi".
 *
 * The parser is used only to FIND boundaries (SPEC: it never rewrites). The
 * columns are slices of the note, so every word on the slide is one the
 * resident typed. What the slide leaves out (owner, 2026-11-13):
 *  - everything above the first "S :" (a "Rencana tindakan" line, an opening list);
 *  - WhatsApp bold/italic marks: the text is the plain / SIMGOS copy (`toPlain`);
 *  - on the left, everything after the newest EKG: the older EKGs, lab, thorax,
 *    echo and procedure reports already have their own slides.
 */

const RIGHT_COLUMN: ReadonlySet<SectionId> = new Set<SectionId>(['a', 'terapi', 'p']);

/** The slide's heading for a WhatsApp-style "Mohon izin kami assess / terapi dengan :" heading. */
const PLAIN_HEADING: Partial<Record<SectionId, string>> = { a: 'Diagnosis:', terapi: 'Terapi:' };

const ECG_LINE = /^[ \t>*_~#]*(?:ekg|ecg|elektrokardiogra)/i;

/**
 * Cuts after the newest dated EKG block (its heading plus the lines under it, up
 * to a blank line or the next investigation heading). No dated EKG: unchanged.
 */
function untilLatestEcg(text: string): string {
  const lines = text.split('\n');
  let at = -1;
  let latest = '';
  lines.forEach((line, i) => {
    if (!ECG_LINE.test(line)) return;
    const heading = matchInvestigationHeading(line);
    if (!heading) return;
    // Strictly newer wins, so the first of equal dates (and notes listing newest first) stays.
    if (at < 0 || (heading.date ?? '') > latest) {
      at = i;
      latest = heading.date ?? '';
    }
  });
  if (at < 0) return text;
  let end = at + 1;
  while (end < lines.length && lines[end]!.trim() && !matchInvestigationHeading(lines[end]!)) end += 1;
  return lines.slice(0, end).join('\n');
}

/** "Mohon izin kami assess / terapi dengan :" → "Diagnosis:" / "Terapi:". Slide copy only: the stored note keeps its own wording. */
export function plainHeadings(input: string, aliases?: readonly SectionAlias[]): string {
  let text = input;
  // Right to left so earlier offsets stay valid.
  for (const section of [...parseSections(text, aliases)].reverse()) {
    const plain = PLAIN_HEADING[section.sectionId];
    if (!plain || !section.headerLine || !/\b(?:mohon|izin|ijin)\b/i.test(section.headerLine)) continue;
    const after = section.start + section.headerLine.length;
    const sameLine = after < text.length && text[after] !== '\n';
    text = `${text.slice(0, section.start)}${plain}${sameLine ? ' ' : ''}${text.slice(after)}`;
  }
  return text;
}

export function soapColumns(
  body: string,
  frame: { identity?: string; rm?: string },
  aliases?: readonly SectionAlias[],
): { col2: string; col3: string } {
  let text = plainHeadings(toPlain(stripReportFrame(body, frame)).trim(), aliases);
  // No "S" heading: keep everything rather than guess where the note begins.
  const first = parseSections(text, aliases).find((section) => section.sectionId === 's');
  if (first) text = text.slice(first.start);
  const split = parseSections(text, aliases).find((section) => RIGHT_COLUMN.has(section.sectionId));
  if (!split) return { col2: untilLatestEcg(text).trim(), col3: '' };
  return { col2: untilLatestEcg(text.slice(0, split.start)).trim(), col3: text.slice(split.start).trim() };
}
