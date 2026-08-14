import { useMemo } from 'react';

import { parseSections } from '@/domain/sections/parseSections';
import { TINT_VAR, tintFor } from '@/domain/sections/sectionTint';
import type { SectionAlias } from '@/domain/types';

/**
 * Faint bands behind the editor, one per part of the note.
 *
 * Drawn UNDERNEATH a transparent textarea rather than around the text, because
 * the editor is a plain textarea by design — the stored body has to stay
 * exactly what was typed, and wrapping sections in elements would mean owning a
 * document model and giving that up.
 *
 * So this renders the same text, invisibly, in an element with identical
 * metrics, and colours the blocks. It is a mirror: every font, spacing and
 * padding value here must match the textarea, or the bands drift from the text
 * they are meant to mark.
 */
export function SectionBands({
  body,
  aliases,
}: {
  body: string;
  aliases: readonly SectionAlias[];
}): JSX.Element {
  const blocks = useMemo(() => {
    const sections = parseSections(body, aliases);
    return sections.map((section, index) => ({
      key: `${section.sectionId}-${index}`,
      text: body.slice(section.start, section.end),
      tint: tintFor(section.sectionId, section.label),
    }));
  }, [body, aliases]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-4 py-3 text-[15px] leading-7"
    >
      {blocks.map((block) => (
        <span
          key={block.key}
          style={block.tint ? { backgroundColor: TINT_VAR[block.tint] } : undefined}
          className="rounded-sm"
        >
          {/* The text itself is invisible — only its shape matters, since the
              real characters are drawn by the textarea sitting on top. */}
          <span className="text-transparent">{block.text}</span>
        </span>
      ))}
    </div>
  );
}
