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
/**
 * Split a body into the spans the mirror renders.
 *
 * Exported and pure so its output can be inspected in a test. The anchor
 * bug that made every jump button do nothing lived here and was invisible:
 * `anchored.add()` ran one line BEFORE the `anchored.has()` that decided
 * whether to emit an anchor, so the answer was always "already seen" and no
 * anchor was ever produced. Nothing could see `parts`, so nothing could
 * catch it.
 */
export function buildBands(
  settled: string,
  aliases: readonly SectionAlias[],
  paint: boolean,
): Array<{
  key: string;
  text: string;
  tint: string | null;
  block?: boolean;
  anchor?: string;
}> {
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
    // Anchors ride the FIRST occurrence of each id, like the tints: a note has
    // three EKG blocks, and "jump to O" means the first one.
    const anchored = new Set<string>();
    const result: Array<{
      key: string;
      text: string;
      tint: string | null;
      block?: boolean;
      anchor?: string;
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

      /**
       * Only a heading that OWNS ITS LINE is tinted.
       *
       * The parser marks `LVSV : 41,8 mL` as a section, correctly — that is
       * how `Penunjang: Hb 12` gets grouped for copying. But it is a FIELD,
       * not a heading, and tinting every one striped an echo block across
       * measurements nobody had marked up.
       *
       * `section.ownsLine` is the parser's single answer to "is this a
       * heading", shared with the jump bar so the two layers cannot drift
       * apart — they did once, and the bar was clean while the tints were not.
       */
      const kind = section.ownsLine ? tintFor(section.sectionId, section.label) : null;
      const tint = kind && !seen.has(kind) ? kind : null;

      /**
       * Decided BEFORE it is recorded, exactly like `tint` above.
       *
       * This read `anchored.has(...)` on the line after `anchored.add(...)`,
       * so the answer was always "already anchored" and NO anchor was ever
       * emitted. The jump bar then looked up `sec-o` and found nothing, which
       * is why every button did nothing at all — not scrolled to the wrong
       * place, nothing.
       *
       * `seen`/`tint` two lines up is the same shape and is correct. Writing
       * the second one by hand instead of following it is how they diverged.
       */
      const anchor =
        section.ownsLine && !anchored.has(section.sectionId) ? section.sectionId : null;

      if (kind) seen.add(kind);
      if (anchor) anchored.add(anchor);

      result.push({
        key: `head-${index}`,
        text: settled.slice(section.start, headerEnd),
        tint: tint && paint ? TINT_VAR[tint] : null,
        block: true,
        ...(anchor ? { anchor } : {}),
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
}

export function SectionBands({
  body,
  aliases,
  paint,
}: {
  body: string;
  aliases: readonly SectionAlias[];
  /**
   * Whether to PAINT the tints. The mirror is mounted either way, because it
   * is also the jump bar's measurement layer — the section anchors are spans
   * in here, and a layer that only existed when tinting was on would make
   * "lompat ke O" work for some users and silently not for others.
   */
  paint: boolean;
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

  const parts = useMemo(
    () => buildBands(settled, aliases, paint),
    [settled, aliases, paint],
  );

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
            id={part.anchor ? `sec-${part.anchor}` : undefined}
            className="-mx-4 block px-4"
            style={{ backgroundColor: part.tint }}
          >
            {part.text}
          </span>
        ) : part.block ? (
          // The anchor rides here too. A heading is untinted whenever the tint
          // setting is off, or when another section already claimed that
          // colour — and in both cases it is still somewhere the jump bar has
          // to be able to reach.
          <span
            key={part.key}
            id={part.anchor ? `sec-${part.anchor}` : undefined}
            className="block"
          >
            {part.text}
          </span>
        ) : (
          <span key={part.key}>{part.text}</span>
        ),
      )}
    </div>
  );
}
