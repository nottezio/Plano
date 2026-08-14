import { useMemo } from 'react';

import { parseSections } from '@/domain/sections/parseSections';
import { TINT_VAR, tintFor } from '@/domain/sections/sectionTint';
import type { SectionAlias } from '@/domain/types';
import { METRICS } from './BodyEditor';

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
  const parts = useMemo(() => {
    const sections = parseSections(body, aliases);
    const result: Array<{ key: string; text: string; tint: string | null }> = [];
    let cursor = 0;

    for (const [index, section] of sections.entries()) {
      // The header is the first line of the section; everything after it is
      // body text and stays untinted.
      const slice = body.slice(section.start, section.end);
      const newline = slice.indexOf('\n');
      const headerEnd = newline === -1 ? section.end : section.start + newline;

      if (section.start > cursor) {
        result.push({ key: `gap-${index}`, text: body.slice(cursor, section.start), tint: null });
      }

      const tint = tintFor(section.sectionId, section.label);
      result.push({
        key: `head-${index}`,
        text: body.slice(section.start, headerEnd),
        tint: tint ? TINT_VAR[tint] : null,
      });
      result.push({ key: `rest-${index}`, text: body.slice(headerEnd, section.end), tint: null });
      cursor = section.end;
    }

    if (cursor < body.length) {
      result.push({ key: 'tail', text: body.slice(cursor), tint: null });
    }

    return result;
  }, [body, aliases]);

  return (
    <div
      aria-hidden="true"
      className={`${METRICS} pointer-events-none absolute inset-0 overflow-hidden text-transparent`}
    >
      {parts.map((part) =>
        part.tint ? (
          <span key={part.key} style={{ backgroundColor: part.tint }}>
            {part.text}
          </span>
        ) : (
          <span key={part.key}>{part.text}</span>
        ),
      )}
    </div>
  );
}
