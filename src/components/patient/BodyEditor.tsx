import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  BOLD,
  ITALIC,
  toggleBullet,
  toggleNumbered,
  toggleWrap,
  type TextEdit,
} from '@/domain/format/markdownLite';
import type { ClinicalDate, SectionAlias } from '@/domain/types';
import { FormatToolbar } from './FormatToolbar';
import { SectionBands } from './SectionBands';
import { SNIPPETS, insertSnippet } from '@/domain/format/snippets';

/**
 * SPEC F4 — one free-form page per clinical day.
 *
 * A plain auto-growing <textarea>, deliberately. A WYSIWYG editor would own
 * the document model, and the moment it does, the stored body stops being
 * exactly what the user typed — which breaks the parser's read-only contract,
 * the byte-faithful copy guarantee, and the three-way merge that operates on
 * plain text. The editor is dumb so that everything downstream can be exact.
 */
/**
 * Everything that decides where a line wraps. Shared verbatim with SectionBands.
 */
export const METRICS =
  'whitespace-pre-wrap break-words px-4 py-3 text-[15px] leading-7 font-sans tracking-normal';

export function BodyEditor({
  value,
  onChange,
  onBlur,
  aliases,
  date,
  tint = false,
  readOnly,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  onBlur: () => void;
  aliases: readonly SectionAlias[];
  /**
   * The clinical day of the note being edited.
   *
   * Used only to date an inserted EKG heading. The note's day, never today's
   * wall clock: a note written after midnight for the previous day has to
   * carry that day's date, which is the rule the rest of the app follows.
   */
  date: ClinicalDate;
  /** Tint section headers; off unless the user turned it on. */
  tint?: boolean;
  readOnly: boolean;
  placeholder: string;
}): JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow: the page scrolls, the textarea never does. A nested scroll
  // region on a phone is how you lose your place mid-round.
  // Length at the last measurement, to tell growth from deletion.
  const lastLength = useRef(0);
  const [focused, setFocused] = useState(false);

  const resize = useCallback(() => {
    const node = ref.current;
    if (!node) return;

    /**
     * Autosize without letting the page jump to the top on every keystroke.
     *
     * The naive version sets `height = 'auto'` to measure, which momentarily
     * collapses the textarea to one row. The scroll container's scrollHeight
     * collapses with it, the browser clamps scrollTop to the new (much
     * smaller) maximum, and when the real height is restored the scroll
     * position is gone — so a long note scrolled itself to the top on every
     * character typed.
     *
     * Fix has three parts: measure against a shrink-only step rather than a
     * full collapse, capture and restore the ancestor's scrollTop around the
     * measurement, and run it in a layout effect so it happens before paint —
     * otherwise the jump is visible even when it is corrected.
     */
    const scroller = node.closest('main') ?? document.scrollingElement;
    const scrollTop = scroller?.scrollTop ?? 0;

    /**
     * The shrink-measure runs only when the text got SHORTER.
     *
     * Setting `height` to 0 and reading `scrollHeight` forces two full layout
     * passes, and it was happening on every keystroke — on a note carrying
     * three days of EKG that is the mobile lag.
     *
     * It is only necessary when the box may now be too tall. When text is added,
     * `scrollHeight` already reports the height needed without collapsing
     * first, so the measurement is one pass instead of two and no scroll
     * restoration is needed either.
     */
    const grew = node.value.length >= lastLength.current;
    lastLength.current = node.value.length;

    if (grew) {
      const needed = `${node.scrollHeight}px`;
      if (node.style.height !== needed) node.style.height = needed;
      return;
    }

    const previous = node.style.height;
    node.style.height = '0px';
    const next = `${node.scrollHeight}px`;
    node.style.height = previous === next ? previous : next;

    if (scroller && scroller.scrollTop !== scrollTop) scroller.scrollTop = scrollTop;
  }, []);

  // Layout effect, not effect: the measurement must land before the browser
  // paints, or the collapse is visible as a flicker.
  useLayoutEffect(resize, [value, resize]);

  /**
   * Re-measure when the box's WIDTH changes, not just its text.
   *
   * Height depends on where lines wrap, and wrapping depends on width — but
   * the effect above only runs when `value` changes. So opening the side
   * panel, resizing the window, rotating the phone, or a web font arriving
   * after first paint all changed the wrapping while the height stayed at its
   * old measurement. The note came out with its last lines cut off, and it
   * only came back when something forced a remount, which is exactly why
   * switching tabs "fixed" it.
   *
   * A `ResizeObserver` on the element itself is the direct statement of that:
   * whenever this box's geometry changes, measure it again.
   */
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return;

    let lastWidth = node.clientWidth;
    const observer = new ResizeObserver(() => {
      // Width only. Observing height would fire on the resize this performs
      // and loop.
      const width = node.clientWidth;
      if (width === lastWidth) return;
      lastWidth = width;
      resize();
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [resize]);

  /**
   * One more measurement once webfonts are in.
   *
   * A font that swaps in after first paint changes every line's height. The
   * promise resolves immediately when fonts are already loaded, so this costs
   * one no-op measurement in the common case.
   */
  useEffect(() => {
    if (!('fonts' in document)) return;
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) resize();
    });
    return () => {
      cancelled = true;
    };
  }, [resize]);

  /**
   * Bring the caret into view, without moving the page when it already is.
   *
   * The caret's position is measured against the scroll container rather than
   * the textarea, because the textarea does not scroll — it is autosized and
   * the page scrolls around it, so `scrollIntoView` on the element would jump
   * to the top of the whole note.
   *
   * A mirror is not needed for this: the selection is at a known offset, and
   * scrolling to roughly the right line is enough for "show me what changed".
   * Being a line out is unimportant; being on the wrong screen is not.
   */
  const revealCaret = useCallback((node: HTMLTextAreaElement) => {
    const scroller = node.closest('main');
    if (!scroller) return;

    const style = window.getComputedStyle(node);
    const lineHeight = Number.parseFloat(style.lineHeight) || 28;
    const linesBefore = node.value.slice(0, node.selectionStart).split('\n').length - 1;

    const caretTop =
      node.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop +
      linesBefore * lineHeight;

    const viewTop = scroller.scrollTop;
    const viewBottom = viewTop + scroller.clientHeight;

    // Already on screen, with a line of margin: leave the page alone.
    if (caretTop > viewTop + lineHeight && caretTop < viewBottom - lineHeight * 2) return;

    // A third of the way down, not at the very top: an edit with no context
    // above it is hard to recognise as the thing you just undid.
    scroller.scrollTo({
      top: Math.max(0, caretTop - scroller.clientHeight / 3),
      behavior: 'smooth',
    });
  }, []);

  const applyEdit = useCallback(
    (edit: TextEdit) => {
      onChange(edit.text);
      requestAnimationFrame(() => {
        const node = ref.current;
        if (!node) return;

        /**
         * The scroll position is captured and restored around this.
         *
         * `focus()` on a textarea whose caret is out of view makes the browser
         * scroll to reveal it, and `setSelectionRange` does the same. For bold
         * and italic the caret moves by a character and nothing is visible;
         * inserting a snippet moves it by a paragraph, and the page jumped to
         * the bottom of the note every time.
         *
         * Restoring afterwards keeps the note where the user left it. The
         * caret is still correct — it is simply not chased.
         */
        const scroller = node.closest('main') ?? document.scrollingElement;
        const scrollTop = scroller?.scrollTop ?? 0;

        node.focus();
        node.setSelectionRange(edit.selectionStart, edit.selectionEnd);

        if (scroller && scroller.scrollTop !== scrollTop) scroller.scrollTop = scrollTop;
      });
    },
    [onChange],
  );

  const withSelection = useCallback(
    (transform: (text: string, start: number, end: number) => TextEdit) => {
      const node = ref.current;
      if (!node) return;
      applyEdit(transform(node.value, node.selectionStart, node.selectionEnd));
    },
    [applyEdit],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!(event.metaKey || event.ctrlKey)) return;
    const key = event.key.toLowerCase();
    if (key === 'b') {
      event.preventDefault();
      withSelection((text, start, end) => toggleWrap(text, start, end, BOLD));
    } else if (key === 'i') {
      event.preventDefault();
      withSelection((text, start, end) => toggleWrap(text, start, end, ITALIC));
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/*
        The mirror and the textarea share one class string.
        
        Colour bleeding into the next section was not a parsing error — it was
        the two layers wrapping at different points because their metrics had
        drifted apart. Anything that affects where a line breaks has to be
        identical, so the shared values live in one constant and both elements
        use it. Changing padding in one place now changes it in both.
      */}
      <div className="relative min-w-0 flex-1">
        {/*
          Mounted unconditionally now, with `paint` deciding whether the tints
          are drawn. It is also the jump bar's measurement layer — the section
          anchors are spans inside it — and a layer that only existed when the
          tint setting was on would have made section jumping work for some
          users and silently not for others.
        */}
        <SectionBands body={value} aliases={aliases} paint={tint} />
        <textarea
          ref={ref}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);

            /**
             * Scroll an undo or redo into view.
             *
             * Native textarea history moves the caret to the edit it reverted,
             * but nothing scrolls there — so undoing a change made further up a
             * long note silently altered text the user could not see, which is
             * the one situation where you most need to check what happened.
             *
             * `inputType` is how the browser reports WHY the value changed, so
             * this fires only for history and not for ordinary typing, where
             * chasing the caret would fight the page.
             */
            const how = (event.nativeEvent as InputEvent).inputType;
            if (how === 'historyUndo' || how === 'historyRedo') {
              revealCaret(event.currentTarget);
            }
          }}
          /**
           * A dropped link is not an edit anyone meant to make.
           *
           * A textarea accepts drag-and-drop natively, so dragging a browser
           * tab, a bookmark, or a selected address into the note inserts the
           * URL wherever it lands — which is where the app's own address kept
           * appearing mid-sentence. Nothing in the app writes it.
           *
           * Dropped plain TEXT is still accepted, because that is a real way to
           * move a phrase between notes. Only URLs are refused.
           */
          onDrop={(event) => {
            const uri = event.dataTransfer.getData('text/uri-list');
            if (uri) {
              event.preventDefault();
              console.warn('[editor] refused a dropped link');
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur();
          }}
          onKeyDown={onKeyDown}
          readOnly={readOnly}
          placeholder={placeholder}
          spellCheck
          /**
           * No `lang` attribute on purpose.
           *
           * The document is `lang="id"`, which makes the browser check Indonesian
           * only — so `patient`, `discharge` and every English abbreviation in a
           * cardiology note gets underlined. Leaving `lang` unset here lets the
           * browser use every dictionary the user has installed, which is the
           * closest thing to a mixed Indonesian/English checker that exists.
           *
           * There is no medical dictionary anywhere: drug names and abbreviations
           * will be flagged. See CHANGES for why shipping one would be worse.
           */
          /**
           * Check, do not change.
           *
           * `autoCorrect` rewrites words as you type; `spellCheck` only
           * underlines them and waits to be asked. On a note full of drug names
           * the difference is the whole thing — an underline you can ignore, a
           * silent substitution in a dose you cannot.
           */
          autoCapitalize="sentences"
          autoCorrect="off"
          autoComplete="off"
          // `break-words` so a pasted lab line with no spaces wraps instead of
          // widening the column and dragging a scrollbar across the page.
          /**
           * `overflow-hidden`, so the textarea never scrolls itself.
           *
           * This box is autosized to its content and the PAGE does the
           * scrolling. Without this, any moment where the measured height lags
           * the content — pressing Enter, pasting a block, the debounced
           * resize not having run yet — gives the textarea its own scrollbar,
           * one whose travel is only the few pixels of difference. It reads as
           * a scrollbar that is stuck, and dragging it fights the autosize.
           *
           * The jaga editor has had this since it was written; this one did
           * not, and the two boxes behaved differently for no reason anybody
           * chose.
           */
          className={`${METRICS} relative w-full resize-none overflow-hidden border-0 bg-transparent outline-none placeholder:text-fg-faint read-only:opacity-70`}
          lang=""
          rows={12}
        />
      </div>

      {/*
        Dimmed until the editor has focus.
        
        It sits over the note permanently, and four buttons that are used
        occasionally should not compete with the text for attention. Focus is
        the right trigger: the toolbar is only reachable while typing anyway.
      */}
      <div
        className={[
          'sticky bottom-0 px-4 pb-2 transition-opacity',
          focused ? 'opacity-100' : 'opacity-40 hover:opacity-100',
        ].join(' ')}
      >
        <FormatToolbar
          disabled={readOnly}
          value={value}
          onReplace={onChange}
          onBold={() => withSelection((text, start, end) => toggleWrap(text, start, end, BOLD))}
          onItalic={() =>
            withSelection((text, start, end) => toggleWrap(text, start, end, ITALIC))
          }
          onBullet={() => withSelection(toggleBullet)}
          onNumbered={() => withSelection(toggleNumbered)}
          onInsertSnippet={(snippetId) => {
            const snippet = SNIPPETS.find((entry) => entry.id === snippetId);
            if (!snippet) return;
            // `date` is the note's clinical day, not today: a note written
            // after midnight for the previous day carries that day's date.
            withSelection((text, start) => insertSnippet(text, start, snippet.build(date)));
          }}
        />
      </div>
    </div>
  );
}
