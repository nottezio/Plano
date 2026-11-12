import { stripReportFrame } from '@/domain/floorList/build';
import { parseSections } from '@/domain/sections/parseSections';
import type { SectionAlias, SectionId } from '@/domain/types';

/**
 * One day's SOAP split into the two text columns of the reference slide:
 * "Anamnesis dan Pemeriksaan Fisik" and "Diagnosis dan Terapi".
 *
 * The parser is used only to FIND the boundary (SPEC: it never rewrites). The
 * columns are two slices of the note with its frame removed, so every character
 * on the slide is one the resident typed. Everything before the first
 * assessment / therapy / plan heading goes left, including any line above "S :"
 * (a "hari rawat" line, an opening-zone diagnosis list): dropping text silently
 * would be worse than showing one line too many.
 */

const RIGHT_COLUMN: ReadonlySet<SectionId> = new Set<SectionId>(['a', 'terapi', 'p']);

/** The slide's heading for a WhatsApp-style "Mohon izin kami assess / terapi dengan :" heading (owner, 2026-11-13). */
const PLAIN_HEADING: Partial<Record<SectionId, string>> = { a: 'Diagnosis:', terapi: 'Terapi:' };

export function soapColumns(
  body: string,
  frame: { identity?: string; rm?: string },
  aliases?: readonly SectionAlias[],
): { col2: string; col3: string } {
  let text = stripReportFrame(body, frame);
  // Slide copy only: the stored note keeps its own wording. Right to left so earlier offsets stay valid.
  for (const section of [...parseSections(text, aliases)].reverse()) {
    const plain = PLAIN_HEADING[section.sectionId];
    if (!plain || !section.headerLine || !/\b(?:mohon|izin|ijin)\b/i.test(section.headerLine)) continue;
    const after = section.start + section.headerLine.length;
    const sameLine = after < text.length && text[after] !== '\n';
    text = `${text.slice(0, section.start)}${plain}${sameLine ? ' ' : ''}${text.slice(after)}`;
  }
  const split = parseSections(text, aliases).find((section) => RIGHT_COLUMN.has(section.sectionId));
  if (!split) return { col2: text.trim(), col3: '' };
  return { col2: text.slice(0, split.start).trim(), col3: text.slice(split.start).trim() };
}
