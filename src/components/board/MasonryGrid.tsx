import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Masonry that lets an item be WIDER than one column.
 *
 * WHY THIS REPLACED CSS MULTI-COLUMN
 *
 * The board used `columns-2 … columns-5`, which is a genuinely good masonry
 * with no measurement pass and no library. It has one property that turned out
 * to be fatal here: a column has one width, and nothing inside it can be wider.
 * Not "looks bad if wider" — anything overflowing paints on top of the next
 * column, which is what the note did across half the board.
 *
 * That ruled out the thing the board actually needed: a card whose note opens
 * OUTWARD, keeping the card the size it was. Inside multicol the only way to
 * fit a note was to shrink the card, which is the opposite of the request and
 * makes the diagnoses harder to read at the moment you added information.
 *
 * Multicol had also already cost us twice through the same underlying rule:
 * absolutely-positioned children of a card have no reliably-resolved
 * containing block inside a fragmented flow, which is how the pemantauan badge
 * ended up in open space between two other cards.
 *
 * HOW THIS WORKS
 *
 * A grid with very short rows — items span as many of them as their measured
 * height needs. `grid-auto-flow: dense` then backfills the gaps, which is what
 * makes it read as masonry rather than as a table with holes in it.
 *
 * The cost is honest: this measures, and multicol did not. Each item watches
 * its own size, so a card growing as a note is typed re-spans on its own
 * without the grid re-measuring everything.
 */

/** Row height. Smaller tracks heights more exactly and costs more rows. */
const ROW = 4;
/** Must match the `row-gap` on the container below. */
const GAP = 12;

export function MasonryGrid({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div
      className="grid grid-cols-1 items-start gap-x-3 px-4 pt-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
      style={{ gridAutoRows: `${ROW}px`, rowGap: `${GAP}px`, gridAutoFlow: 'row dense' }}
    >
      {children}
    </div>
  );
}

export function MasonryItem({ children }: { children: ReactNode }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [span, setSpan] = useState(1);

  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    /**
     * `getBoundingClientRect` rather than `offsetHeight`: heights here are
     * fractional far more often than not — a 13 px line at a non-integer
     * device pixel ratio — and rounding each card down accumulates into the
     * next card overlapping it by a few pixels near the bottom of a long
     * column.
     */
    const height = node.getBoundingClientRect().height;
    // The gap is added first because the last row of an item does not carry
    // one; without it every item is short by exactly one gap.
    setSpan(Math.max(1, Math.ceil((height + GAP) / (ROW + GAP))));
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div style={{ gridRowEnd: `span ${String(span)}` }}>
      <div ref={ref}>{children}</div>
    </div>
  );
}
