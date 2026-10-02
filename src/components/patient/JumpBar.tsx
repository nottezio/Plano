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
  bookmarks = [],
  onBookmark,
  missingBookmarks = 0,
  onClearMissing,
}: {
  body: string;
  aliases: readonly SectionAlias[];
  /**
   * Bookmarked lines of the note on screen, top to bottom. After the sections:
   * the sections are the note's own structure and always in the same place on
   * this bar, the bookmarks are the user's and come and go.
   */
  bookmarks?: ReadonlyArray<{ id: string; label: string }>;
  onBookmark?: ((id: string) => void) | undefined;
  /** Bookmarks whose line is not in this note (kept: it may be back tomorrow). */
  missingBookmarks?: number;
  onClearMissing?: (() => void) | undefined;
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
  if (targets.length < 2 && bookmarks.length === 0 && missingBookmarks === 0) return null;

  return (
    <div
      // Horizontal scroll rather than wrap: a second row would push the note
      // itself further down every screen, and this is furniture.
      /*
        No vertical padding, and the buttons carry the whole row height.
        The row was 44 px of button inside 8 px of padding inside a border —
        two thirds furniture — on a screen whose entire purpose is the note
        below it. The tap target is untouched at 44 px; what went is the empty
        space around it.
      */
      className="flex gap-0.5 overflow-x-auto border-b border-border px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {targets.map((target) => (
        <button
          key={target.sectionId}
          type="button"
          onClick={() => jump(target.anchorId)}
          /*
            32px, below the 44px floor the rest of the app holds to, and that is
            deliberate rather than an oversight.

            This is a shortcut, not a destination: every section it jumps to is
            reachable by scrolling the note that is already on screen, so a miss
            costs a scroll rather than an action. Against that, a 44px strip
            across the top of the editor was taking a line and a half of the
            note itself on a phone — permanently, on the one screen where the
            content is the point. The targets are also wide, which is the axis a
            thumb actually misses on.
          */
          className="h-8 shrink-0 rounded-lg px-2 text-[11px] font-medium text-fg-muted"
        >
          {target.label}
        </button>
      ))}
      {bookmarks.length > 0 ? (
        <span aria-hidden="true" className="my-2 w-px shrink-0 bg-border" />
      ) : null}
      {bookmarks.map((bookmark) => (
        <button
          key={bookmark.id}
          type="button"
          onClick={() => onBookmark?.(bookmark.id)}
          title={`Ke baris: ${bookmark.label}`}
          className="flex h-8 max-w-[11rem] shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-accent"
        >
          <svg
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="currentColor"
            aria-hidden="true"
            className="shrink-0"
          >
            <path d="M6 4h12v16l-6-4-6 4z" />
          </svg>
          <span className="truncate">{bookmark.label}</span>
        </button>
      ))}
      {missingBookmarks > 0 && onClearMissing ? (
        <button
          type="button"
          onClick={onClearMissing}
          title="Baris yang di-bookmark tidak ada di catatan hari ini. Ketuk untuk menghapus bookmark-nya."
          className="h-8 shrink-0 rounded-lg px-2 text-[11px] text-fg-faint"
        >
          {missingBookmarks} bookmark tidak ditemukan · Hapus
        </button>
      ) : null}
    </div>
  );
}
