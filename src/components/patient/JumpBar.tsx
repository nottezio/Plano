import { useCallback } from 'react';

import { jumpTargets } from '@/domain/sections/jumpTargets';
import type { SectionAlias } from '@/domain/types';

/**
 * Jump to a section of the note.
 *
 * The body is ONE textarea by design (see BodyEditor), so S/O/A/Terapi/Plan are
 * character offsets in a string, not elements — there is nothing to link to.
 * The targets are spans in `SectionBands`, the invisible mirror that already
 * exists to paint header tints and is laid out with the textarea's exact
 * metrics. Reusing it is deliberate: a second measurement path would have its
 * own idea of where a line wraps, and the two drifting apart is precisely the
 * bug that mirror's comments describe.
 *
 * Clearance for the sticky header is MEASURED, not encoded.
 *
 * The first version used `scroll-mt-28` — 112 px, matching a two-row header —
 * and then this bar became the third row in the same change, so the constant
 * was stale before it shipped. The heading landed behind the header, which
 * reads as jumping too far.
 *
 * Any fixed number here is the header's height written down in a second place,
 * and the two will disagree the next time a row is added or a font changes.
 * Reading `getBoundingClientRect().height` off the header at jump time cannot
 * drift, because there is only one copy of the fact.
 */
export function JumpBar({
  body,
  aliases,
}: {
  body: string;
  aliases: readonly SectionAlias[];
}): JSX.Element | null {
  const targets = jumpTargets(body, aliases);

  const jump = useCallback((anchorId: string | null) => {
    const scroller = document.querySelector('main');
    if (!scroller) return;

    // Identity is the sticky header itself, so its target is the top of the
    // scroll container — there is no anchor for it in the body mirror.
    if (!anchorId) {
      scroller.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const node = document.getElementById(anchorId);
    /**
     * Silently do nothing if the anchor is missing, rather than scrolling to
     * the top as a fallback.
     *
     * The mirror parses from a 300 ms debounced copy of the body, so for a
     * moment after typing a new header the button can exist before its anchor
     * does. Jumping to the top in that window would move the page somewhere
     * the user did not ask for, which is worse than not moving: they would
     * lose their place mid-note and have to find it again.
     */
    if (!node) return;

    const header = document.getElementById('patient-sticky-header');
    const clearance = header?.getBoundingClientRect().height ?? 0;

    /**
     * Positioned so the header line sits immediately BELOW the sticky bar —
     * "jump to O" should put `*O :*` at the top of what you can read, not one
     * line above it and not hidden behind the bar.
     *
     * Computed from the current scroll position plus the node's offset from
     * the scroller's own box, rather than `offsetTop`: the anchors live in an
     * absolutely-positioned mirror, so their `offsetTop` is relative to that
     * mirror, not to the scroll container.
     */
    const top =
      scroller.scrollTop +
      node.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top -
      clearance;

    scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, []);

  // One button is the identity button alone, which is just "scroll up" — not
  // worth a row of chrome on a phone.
  if (targets.length < 2) return null;

  return (
    <div
      // Horizontal scroll rather than wrap: a second row would push the note
      // itself further down every screen, and this is furniture.
      className="flex gap-1 overflow-x-auto border-b border-border px-4 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {targets.map((target) => (
        <button
          key={target.sectionId}
          type="button"
          onClick={() => jump(target.anchorId)}
          className="min-h-tap shrink-0 rounded-lg px-2.5 text-xs font-medium text-fg-muted"
        >
          {target.label}
        </button>
      ))}
    </div>
  );
}
