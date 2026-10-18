import { useState, type ReactNode } from 'react';
import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';

import { useMediaQuery } from '@/hooks/useMediaQuery';

import { moveBlock } from './commands';
import { listItemTypeAtCaret } from './schema';

/**
 * The Catatan toolbar (rebuilt 18 Oct 2026 on TipTap). One sticky row that
 * scrolls sideways on a phone. Text size is gone (headings replace it); ↑/↓
 * appear on touch screens, where the ⠿ handle is too small to drag.
 */

const COLORS = [
  { label: 'Biasa', token: null },
  { label: 'Merah', token: '--note-red' },
  { label: 'Kuning', token: '--note-amber' },
  { label: 'Hijau', token: '--note-green' },
  { label: 'Biru', token: '--note-blue' },
] as const;

/** A colour VALUE from the token layer, so the stored note keeps it across themes. */
function resolveToken(token: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value || 'currentColor';
}

export function Toolbar({ editor }: { editor: Editor }): JSX.Element {
  const coarse = useMediaQuery('(pointer: coarse)');
  const [showColors, setShowColors] = useState(false);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const item = listItemTypeAtCaret(e);
      return {
        checklist: e.isActive('checklist'),
        bullet: e.isActive('bulletList'),
        number: e.isActive('orderedList'),
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        sink: item !== null && e.can().sinkListItem(item),
        lift: item !== null && e.can().liftListItem(item),
        up: e.can().command(({ state: s }) => moveBlock('up')(s)),
        down: e.can().command(({ state: s }) => moveBlock('down')(s)),
        item,
      };
    },
  });

  const chain = () => editor.chain().focus();

  return (
    <div
      role="toolbar"
      aria-label="Format"
      className="sticky top-0 z-10 flex items-center gap-0.5 overflow-x-auto border-b border-border bg-surface px-2"
    >
      <Tool label="Checklist" pressed={state.checklist} onClick={() => chain().toggleList('checklist', 'checklistItem').run()}>
        <span aria-hidden="true" className="inline-block h-4 w-4 rounded border-2 border-current" />
      </Tool>
      <Tool label="Daftar berpoin" pressed={state.bullet} onClick={() => chain().toggleBulletList().run()}>
        •≡
      </Tool>
      <Tool label="Daftar bernomor" pressed={state.number} onClick={() => chain().toggleOrderedList().run()}>
        1.
      </Tool>
      <Tool label="Kurangi indentasi" disabled={!state.lift} onClick={() => state.item && chain().liftListItem(state.item).run()}>
        ⇤
      </Tool>
      <Tool label="Tambah indentasi" disabled={!state.sink} onClick={() => state.item && chain().sinkListItem(state.item).run()}>
        ⇥
      </Tool>
      {coarse ? (
        <>
          <Tool label="Pindah ke atas" disabled={!state.up} onClick={() => chain().command(({ state: s, dispatch }) => moveBlock('up')(s, dispatch)).run()}>
            ↑
          </Tool>
          <Tool label="Pindah ke bawah" disabled={!state.down} onClick={() => chain().command(({ state: s, dispatch }) => moveBlock('down')(s, dispatch)).run()}>
            ↓
          </Tool>
        </>
      ) : null}
      <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border" />
      <Tool label="Tebal" pressed={state.bold} onClick={() => chain().toggleBold().run()}>
        <strong>B</strong>
      </Tool>
      <Tool label="Miring" pressed={state.italic} onClick={() => chain().toggleItalic().run()}>
        <em>I</em>
      </Tool>
      <Tool label="Garis bawah" pressed={state.underline} onClick={() => chain().toggleUnderline().run()}>
        <span className="underline">U</span>
      </Tool>
      <Tool label="Warna teks" pressed={showColors} onClick={() => setShowColors((on) => !on)}>
        <span className="font-semibold text-[var(--note-red)]">A</span>
      </Tool>
      {showColors
        ? COLORS.map((color) => (
            <Tool
              key={color.label}
              label={`Warna ${color.label}`}
              onClick={() =>
                color.token ? chain().setColor(resolveToken(color.token)).run() : chain().unsetColor().run()
              }
            >
              <span
                aria-hidden="true"
                className="h-5 w-5 rounded-full border border-border-strong"
                style={{ backgroundColor: color.token ? `var(${color.token})` : 'var(--fg)' }}
              />
            </Tool>
          ))
        : null}
    </div>
  );
}

function Tool({
  label,
  onClick,
  pressed,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      disabled={disabled}
      // Keep the selection in the note: a button press must not take focus.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={[
        'flex min-h-tap min-w-tap shrink-0 items-center justify-center rounded-lg text-sm hover:bg-bg-subtle disabled:opacity-35',
        pressed ? 'bg-bg-subtle text-accent' : 'text-fg-muted',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
