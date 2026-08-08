import { useCallback, useLayoutEffect, useRef } from 'react';

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

/**
 * SPEC F4 — one free-form page per clinical day.
 *
 * A plain auto-growing <textarea>, deliberately. A WYSIWYG editor would own
 * the document model, and the moment it does, the stored body stops being
 * exactly what the user typed — which breaks the parser's read-only contract,
 * the byte-faithful copy guarantee, and the three-way merge that operates on
 * plain text. The editor is dumb so that everything downstream can be exact.
 */
export function BodyEditor({
  value,
  onChange,
  onBlur,
  aliases,
  readOnly,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  onBlur: () => void;
  aliases: readonly SectionAlias[];
  readOnly: boolean;
  placeholder: string;
}): JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow: the page scrolls, the textarea never does. A nested scroll
  // region on a phone is how you lose your place mid-round.
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
      <div className="min-w-0 flex-1 px-4 py-3">
        <textarea
          ref={ref}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          readOnly={readOnly}
          placeholder={placeholder}
          spellCheck
          autoCapitalize="sentences"
          autoCorrect="on"
          // `break-words` so a pasted lab line with no spaces wraps instead of
          // widening the column and dragging a scrollbar across the page.
          className="w-full resize-none break-words border-0 bg-transparent text-[15px] leading-7 outline-none placeholder:text-fg-faint read-only:opacity-70"
          rows={12}
        />
      </div>

      <div className="sticky bottom-0 px-4 pb-2">
        <FormatToolbar
          aliases={aliases}
          disabled={readOnly}
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
