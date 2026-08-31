import { useCallback, useRef } from 'react';

import {
  BOLD,
  ITALIC,
  toggleBullet,
  toggleNumbered,
  toggleWrap,
  type TextEdit,
} from '@/domain/format/markdownLite';
import type { SectionAlias, ShiftNote } from '@/domain/types';
import { FormatToolbar } from './FormatToolbar';
import { METRICS } from './BodyEditor';
import { SectionBands } from './SectionBands';

/**
 * Opening height, in pixels.
 *
 * A jaga note is short, but 160 px showed about three lines and made the box
 * read as a single-line field on a laptop — it looked like somewhere to put a
 * sentence, not a finding. Tall enough that the common case needs no growth at
 * all, and it grows past this anyway.
 */
const MIN_HEIGHT = 260;

/**
 * The editor for one jaga note, shown in place of the day's SOAP.
 *
 * Visibly not a SOAP editor. It has a header naming what it is and the time it
 * was opened, a way back to the day, and no format toolbar, no section tinting
 * and no jump bar — because it has no sections. A jaga note is a short free
 * paragraph about one complaint, and giving it the daily note's furniture
 * would invite it to be written like one, which is exactly the confusion the
 * separate document exists to prevent.
 */
export function ShiftNoteEditor({
  note,
  readOnly,
  aliases,
  onChange,
  onBlur,
  onClear,
  onBack,
}: {
  note: ShiftNote;
  readOnly: boolean;
  aliases: readonly SectionAlias[];
  onChange: (body: string) => void;
  onBlur: () => void;
  onClear: () => void;
  onBack: () => void;
}): JSX.Element {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  /**
   * Height follows the content.
   *
   * `auto` first, or the box can only grow and never shrink back when text is
   * deleted.
   *
   * Called from BOTH the callback ref and `onChange`, and both are needed. The
   * first version wired it to the ref alone, which measures when the element
   * mounts and never again — so the box opened at its minimum and stayed
   * there no matter how much was typed into it. That is the same mistake as
   * the `Catatan pasien` textarea, which was keyed on value and so never ran
   * on mount: one ran only at mount, the other only after it. A growing
   * textarea needs measuring at both.
   */
  /**
   * Height follows the content, without moving the page.
   *
   * The naive version — `height = 'auto'` then `height = scrollHeight` — jumps
   * the scroll on EVERY KEYSTROKE. Between those two assignments the textarea
   * collapses to a single line, the scroll container shrinks by the height of
   * the box, and the browser clamps `scrollTop` to fit the shorter document.
   * Expanding again restores the height but not the scroll position, so the
   * view slides upward once per character typed.
   *
   * Two things prevent that. The measurement happens against a COPY of the
   * box's own metrics rather than by collapsing the real one, and the scroll
   * position of the nearest scrollable ancestor is captured and restored
   * around the write in the same synchronous block, so nothing is painted in
   * between.
   */
  const grow = useCallback((node: HTMLTextAreaElement | null) => {
    if (!node) return;

    const scroller = node.closest('main') ?? document.scrollingElement;
    const top = scroller?.scrollTop ?? 0;

    node.style.height = 'auto';
    const next = `${Math.max(node.scrollHeight, MIN_HEIGHT)}px`;

    // Assigning the same value still triggers a style recalculation, and on a
    // long note that is the difference between typing that feels immediate and
    // typing that stutters.
    if (node.style.height !== next) node.style.height = next;

    if (scroller && scroller.scrollTop !== top) scroller.scrollTop = top;
  }, []);

  /**
   * Apply a text transform to the current selection.
   *
   * Reads position straight off the DOM node rather than tracking it in state:
   * the caret moves on every click and arrow key, and mirroring that into
   * React would be a second copy of a value the element already holds
   * authoritatively.
   */
  const withSelection = useCallback(
    (transform: (text: string, start: number, end: number) => TextEdit) => {
      const node = ref.current;
      if (!node || readOnly) return;
      const edit = transform(node.value, node.selectionStart, node.selectionEnd);
      onChange(edit.text);
      // Restore after React has written the new value, or the caret lands at
      // the end and the next keystroke appends instead of continuing.
      requestAnimationFrame(() => {
        node.setSelectionRange(edit.selectionStart, edit.selectionEnd);
        node.focus();
        grow(node);
      });
    },
    [onChange, readOnly, grow],
  );

  return (
    <section aria-label={`SOAP jaga jam ${note.time}`} className="px-4">
      <div className="mt-2 flex items-center gap-2 rounded-t-lg border border-b-0 border-border bg-bg-subtle px-3 py-1.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Kembali ke SOAP hari ini"
          className="min-h-tap shrink-0 text-xs text-accent"
        >
          ← SOAP hari ini
        </button>
        <span className="min-w-0 flex-1 truncate text-right text-xs font-medium text-fg-muted">
          SOAP jaga · {note.time}
        </span>
        <button
          type="button"
          disabled={readOnly}
          onClick={onClear}
          aria-label={`Hapus SOAP jaga jam ${note.time}`}
          className="min-h-tap min-w-tap shrink-0 text-fg-faint disabled:opacity-40"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      {/*
        The same toolbar as the daily note.
        
        A jaga note is sent to the same people, through the same two surfaces,
        and gets read the same way — `*bold*` headings and `- ` bullets matter
        in WhatsApp whether the finding was made at 09.00 or 23.42. Giving it a
        plain textarea meant the emphasis had to be typed by hand, which is
        both slower and the thing this toolbar exists to replace.

        `onInsertSection` is absent: a jaga note has no section structure, and
        offering to insert `*O:*` headings into it would invite it to be
        written as a second daily note.
      */}
      <FormatToolbar
        aliases={aliases}
        disabled={readOnly}
        value={note.body}
        onReplace={onChange}
        onBold={() => withSelection((text, start, end) => toggleWrap(text, start, end, BOLD))}
        onItalic={() => withSelection((text, start, end) => toggleWrap(text, start, end, ITALIC))}
        onBullet={() => withSelection(toggleBullet)}
        onNumbered={() => withSelection(toggleNumbered)}
      />

      {/*
        The same mirror the daily note uses.

        It is what the jump bar measures against — the section anchors are
        spans inside it — so without one here the bar's buttons pointed at
        elements that did not exist and silently scrolled nowhere. A jaga note
        carries `*S:*` and `*O:*` headings like any other, so it has the same
        need to be navigated.

        `paint={false}`: the tints are a reading aid for a long daily note, and
        a jaga note is short enough that colour bands would be decoration. The
        anchors are the reason it is mounted.
      */}
      <div className="relative">
        <SectionBands body={note.body} aliases={aliases} paint={false} />

      <textarea
        ref={(node) => {
          ref.current = node;
          grow(node);
        }}
        value={note.body}
        readOnly={readOnly}
        onChange={(event) => {
          onChange(event.target.value);
          grow(event.currentTarget);
        }}
        onBlur={onBlur}
        placeholder="Keluhan saat jaga…"
        // `METRICS` verbatim, shared with the mirror. If these two lay text
        // out differently by even a pixel the anchors drift from the words
        // they name, which is the failure the mirror's own comments describe.
        className={`${METRICS} relative w-full resize-none overflow-hidden [overflow-wrap:anywhere] rounded-b-lg border border-border bg-transparent outline-none placeholder:text-fg-faint`}
      />
      </div>
    </section>
  );
}
