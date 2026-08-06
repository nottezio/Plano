import { useCallback, useEffect, useRef } from 'react';

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
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight}px`;
  }, []);

  useEffect(resize, [value, resize]);

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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 px-4 py-3">
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
          className="w-full resize-none border-0 bg-transparent text-[15px] leading-7 outline-none placeholder:text-fg-faint read-only:opacity-70"
          rows={12}
        />
      </div>

      <div className="sticky bottom-0">
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
