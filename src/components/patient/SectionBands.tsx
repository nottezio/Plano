import { useMemo } from 'react';

import { parseSections } from '@/domain/sections/parseSections';
import { TINT_VAR, tintFor } from '@/domain/sections/sectionTint';
import type { SectionAlias } from '@/domain/types';
import { METRICS } from './BodyEditor';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

/**
 * A faint background behind each section HEADER, so a scroll shows you which
 * part of the note you are in.
 *
 * Headers only, not whole blocks. Tinting a whole section put colour behind
 * running text, which reads as highlighting — as if those words were marked —
 * and any drift between this mirror and the textarea showed up as colour
 * bleeding into the section below. A header is one line and a short one, so
 * there is far less surface for either problem.
 *
 * The mirror technique is unavoidable: the editor is a plain textarea by
 * design, because the stored body has to stay exactly what was typed and
 * wrapping sections in elements would mean owning a document model. So the same
 * text is laid out invisibly underneath, and only the header lines are painted.
 *
 * EVERY metric here must match the textarea exactly — font, size, line height,
 * padding, wrapping. They are set together in BodyEditor for that reason.
 */
export function SectionBands({
  body,
  aliases,
}: {
  body: string;
  aliases: readonly SectionAlias[];
}): JSX.Element {
  /**
   * Parsed from a settled copy, not from every keystroke.
   *
   * The bands are a scanning aid — being a fraction of a second behind the
   * cursor costs nothing, and re-parsing a long note on every character is what
   * made typing feel heavy. The text itself is drawn by the textarea above and
   * is never delayed.
   */
  const settled = useDebouncedValue(body, 300);

  const parts = useMemo(() => {
    const sections = parseSections(settled, aliases);
    /**
     * One band per section KIND, at its first appearance.
     *
     * A note carries three EKG blocks, five lab dates and two consult replies,
     * and tinting every one produced a striped page where the colour said
     * nothing — the point of the band is "you have arrived at O", not "here is
     * another O-ish thing". Marking only the first occurrence makes the colour
     * a boundary again, which is what a scanning aid is.
     */
    const seen = new Set<string>();
    const result: Array<{
      key: string;
      text: string;
      tint: string | null;
      block?: boolean;
    }> = [];
    let cursor = 0;

    for (const [index, section] of sections.entries()) {
      // The header is the first line of the section; everything after it is
      // body text and stays untinted.
      const slice = settled.slice(section.start, section.end);
      const newline = slice.indexOf('\n');
      const headerEnd = newline === -1 ? section.end : section.start + newline;

      if (section.start > cursor) {
        result.push({
          key: `gap-${index}`,
          text: settled.slice(cursor, section.start),
          tint: null,
        });
      }

      const kind = tintFor(section.sectionId, section.label);
      const tint = kind && !seen.has(kind) ? kind : null;
      if (kind) seen.add(kind);
      result.push({
        key: `head-${index}`,
        text: settled.slice(section.start, headerEnd),
        tint: tint ? TINT_VAR[tint] : null,
        block: true,
      });
      // The newline is consumed by the block above — a block element already
      // ends its line, so leaving the `\n` here would open a second one and
      // every band would drift one line further down the note.
      const restStart = settled[headerEnd] === '\n' ? headerEnd + 1 : headerEnd;
      result.push({
        key: `rest-${index}`,
        text: settled.slice(restStart, section.end),
        tint: null,
      });
      cursor = section.end;
    }

    if (cursor < settled.length) {
      result.push({ key: 'tail', text: settled.slice(cursor), tint: null });
    }

    return result;
  }, [settled, aliases]);

  return (
    <div
      aria-hidden="true"
      className={`${METRICS} pointer-events-none absolute inset-0 overflow-hidden text-transparent`}
    >
      {parts.map((part) =>
        part.tint ? (
          // Block, and stretched past the padding to both edges: a band that
          // stops at the last character reads as a highlight on those words.
          // Running border to border reads as the section it marks.
          <span
            key={part.key}
            className="-mx-4 block px-4"
            style={{ backgroundColor: part.tint }}
          >
            {part.text}
          </span>
        ) : part.block ? (
          <span key={part.key} className="block">
            {part.text}
          </span>
        ) : (
          <span key={part.key}>{part.text}</span>
        ),
      )}
    </div>
  );
}
