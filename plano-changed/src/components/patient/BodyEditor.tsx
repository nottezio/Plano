import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import {
  BOLD,
  ITALIC,
  insertSectionHeader,
  toggleBullet,
  toggleNumbered,
  toggleWrap,
  type TextEdit,
} from '@/domain/format/markdownLite';
import type { SectionAlias } from '@/domain/types';
import { FormatToolbar } from './FormatToolbar';
import { SectionBands } from './SectionBands';

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
  tint = false,
  readOnly,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  onBlur: () => void;
  aliases: readonly SectionAlias[];
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

  const applyEdit = useCallback(
    (edit: TextEdit) => {
      onChange(edit.text);
      requestAnimationFrame(() => {
        const node = ref.current;
        if (!node) return;
        node.focus();
        node.setSelectionRange(edit.selectionStart, edit.selectionEnd);
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
        {tint ? <SectionBands body={value} aliases={aliases} /> : null}
        <textarea
          ref={ref}
          value={value}
          onChange={(event) => onChange(event.target.value)}
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
          className={`${METRICS} relative w-full resize-none border-0 bg-transparent outline-none placeholder:text-fg-faint read-only:opacity-70`}
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
          aliases={aliases}
          disabled={readOnly}
          value={value}
          onReplace={onChange}
          onBold={() => withSelection((text, start, end) => toggleWrap(text, start, end, BOLD))}
          onItalic={() =>
            withSelection((text, start, end) => toggleWrap(text, start, end, ITALIC))
          }
          onBullet={() => withSelection(toggleBullet)}
          onNumbered={() => withSelection(toggleNumbered)}
          onInsertSection={(label) =>
            withSelection((text, start) => insertSectionHeader(text, start, label))
          }
        />
      </div>
    </div>
  );
}
