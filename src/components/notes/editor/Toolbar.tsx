import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';

import { useMediaQuery } from '@/hooks/useMediaQuery';

import { lineToToggle, moveBlock } from './commands';
import { listItemTypeAtCaret } from './schema';
import { stampText } from './stamp';

/**
 * The Catatan toolbar.
 *
 * 18 Oct 2026: rebuilt on TipTap. 19 Oct 2026 (Avi: "rudimentary, richen the
 * experience"): grouped like a document editor — history · block style ·
 * lists · text · insert · tidy — with the block style, colours and inserts in
 * dropdowns so the row stays one line. ↑/↓ only on touch screens.
 *
 * The dropdowns are portalled and fixed under their button: the row scrolls
 * sideways on a phone (`overflow-x-auto`), which would clip anything
 * positioned inside it.
 */

const TEXT_COLORS = [
  { label: 'Merah', token: '--note-red' },
  { label: 'Kuning', token: '--note-amber' },
  { label: 'Hijau', token: '--note-green' },
  { label: 'Biru', token: '--note-blue' },
] as const;

const HIGHLIGHTS = [
  { label: 'Kuning', token: '--hl-yellow' },
  { label: 'Hijau', token: '--hl-green' },
  { label: 'Biru', token: '--hl-blue' },
  { label: 'Merah muda', token: '--hl-pink' },
] as const;

/** A colour VALUE from the token layer: stored in the note, it must not depend on the theme's variables. */
function resolveToken(token: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value || 'currentColor';
}

type BlockStyle = 'p' | 'h1' | 'h2' | 'h3' | 'quote';
const BLOCK_LABEL: Record<BlockStyle, string> = {
  p: 'Teks',
  h1: 'Judul 1',
  h2: 'Judul 2',
  h3: 'Judul 3',
  quote: 'Kutipan',
};

type Open = null | 'block' | 'color' | 'insert';

export function Toolbar({ editor }: { editor: Editor }): JSX.Element {
  const coarse = useMediaQuery('(pointer: coarse)');
  const [open, setOpen] = useState<Open>(null);
  const anchors = useRef<Record<Exclude<Open, null>, HTMLButtonElement | null>>({ block: null, color: null, insert: null });

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const item = listItemTypeAtCaret(e);
      const block: BlockStyle = e.isActive('blockquote')
        ? 'quote'
        : e.isActive('heading', { level: 1 })
          ? 'h1'
          : e.isActive('heading', { level: 2 })
            ? 'h2'
            : e.isActive('heading', { level: 3 })
              ? 'h3'
              : 'p';
      return {
        block,
        checklist: e.isActive('checklist'),
        bullet: e.isActive('bulletList'),
        number: e.isActive('orderedList'),
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        strike: e.isActive('strike'),
        undo: e.can().undo(),
        redo: e.can().redo(),
        sink: item !== null && e.can().sinkListItem(item),
        lift: item !== null && e.can().liftListItem(item),
        up: e.can().command(({ state: s }) => moveBlock('up')(s)),
        down: e.can().command(({ state: s }) => moveBlock('down')(s)),
        item,
      };
    },
  });

  const chain = () => editor.chain().focus();
  const toggle = (which: Exclude<Open, null>): void => setOpen((now) => (now === which ? null : which));
  const done = (run: () => void) => (): void => {
    run();
    setOpen(null);
  };

  const setBlock = (style: BlockStyle): void => {
    const c = chain();
    if (style === 'quote') {
      if (!editor.isActive('blockquote')) c.setParagraph().setBlockquote().run();
      return;
    }
    const base = editor.isActive('blockquote') ? c.lift('blockquote') : c;
    if (style === 'p') base.setParagraph().run();
    else base.setHeading({ level: Number(style.slice(1)) as 1 | 2 | 3 }).run();
  };

  return (
    <div
      role="toolbar"
      aria-label="Format"
      className="sticky top-0 z-10 flex items-center gap-0.5 overflow-x-auto border-b border-border bg-surface px-2"
    >
      <Tool label="Urungkan" disabled={!state.undo} onClick={() => chain().undo().run()}>
        ↶
      </Tool>
      <Tool label="Ulangi" disabled={!state.redo} onClick={() => chain().redo().run()}>
        ↷
      </Tool>
      <Sep />

      <button
        ref={(node) => {
          anchors.current.block = node;
        }}
        type="button"
        aria-label={`Gaya blok: ${BLOCK_LABEL[state.block]}`}
        aria-haspopup="menu"
        aria-expanded={open === 'block'}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => toggle('block')}
        className="flex min-h-tap shrink-0 items-center gap-1 rounded-lg px-2 text-sm text-fg hover:bg-bg-subtle"
      >
        <span className="w-[4.5rem] truncate text-left">{BLOCK_LABEL[state.block]}</span>
        <span aria-hidden="true" className="text-xs text-fg-muted">▾</span>
      </button>
      <Sep />

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
      <Sep />

      <Tool label="Tebal" pressed={state.bold} onClick={() => chain().toggleBold().run()}>
        <strong>B</strong>
      </Tool>
      <Tool label="Miring" pressed={state.italic} onClick={() => chain().toggleItalic().run()}>
        <em>I</em>
      </Tool>
      <Tool label="Garis bawah" pressed={state.underline} onClick={() => chain().toggleUnderline().run()}>
        <span className="underline">U</span>
      </Tool>
      <Tool label="Coret" pressed={state.strike} onClick={() => chain().toggleStrike().run()}>
        <span className="line-through">S</span>
      </Tool>
      <Tool
        label="Warna dan stabilo"
        pressed={open === 'color'}
        anchor={(node) => {
          anchors.current.color = node;
        }}
        onClick={() => toggle('color')}
      >
        <span className="flex flex-col items-center leading-none">
          <span className="font-semibold">A</span>
          <span aria-hidden="true" className="mt-0.5 h-1 w-4 rounded-sm bg-[var(--note-red)]" />
        </span>
      </Tool>
      <Sep />

      <Tool
        label="Sisipkan"
        pressed={open === 'insert'}
        anchor={(node) => {
          anchors.current.insert = node;
        }}
        onClick={() => toggle('insert')}
      >
        <span aria-hidden="true" className="text-base">⊕</span>
      </Tool>
      <Tool label="Bersihkan format" onClick={() => chain().unsetAllMarks().clearNodes().run()}>
        <span aria-hidden="true" className="relative">
          T<span className="absolute -right-1.5 -bottom-1 text-[11px]">✕</span>
        </span>
      </Tool>

      {open === 'block' ? (
        <Popover anchor={anchors.current.block} onClose={() => setOpen(null)} label="Gaya blok">
          {(Object.keys(BLOCK_LABEL) as BlockStyle[]).map((style) => (
            <MenuRow key={style} selected={state.block === style} onClick={done(() => setBlock(style))}>
              <span
                className={
                  style === 'h1'
                    ? 'text-lg font-bold'
                    : style === 'h2'
                      ? 'text-base font-semibold'
                      : style === 'h3'
                        ? 'text-sm font-semibold'
                        : style === 'quote'
                          ? 'border-l-2 border-border-strong pl-2 text-fg-muted'
                          : ''
                }
              >
                {BLOCK_LABEL[style]}
              </span>
            </MenuRow>
          ))}
        </Popover>
      ) : null}

      {open === 'color' ? (
        <Popover anchor={anchors.current.color} onClose={() => setOpen(null)} label="Warna dan stabilo">
          <p className="px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-fg-faint">Warna teks</p>
          <div className="flex flex-wrap gap-0.5 px-1">
            <Swatch label="Warna biasa" onClick={done(() => chain().unsetColor().run())} style={{ backgroundColor: 'var(--fg)' }} />
            {TEXT_COLORS.map((c) => (
              <Swatch
                key={c.token}
                label={`Warna ${c.label}`}
                onClick={done(() => chain().setColor(resolveToken(c.token)).run())}
                style={{ backgroundColor: `var(${c.token})` }}
              />
            ))}
          </div>
          <p className="px-2 pt-2 text-xs font-semibold uppercase tracking-wide text-fg-faint">Stabilo</p>
          <div className="flex flex-wrap gap-0.5 px-1 pb-1">
            <Swatch label="Tanpa stabilo" onClick={done(() => chain().unsetHighlight().run())} style={{ backgroundColor: 'var(--surface)' }} crossed />
            {HIGHLIGHTS.map((h) => (
              <Swatch
                key={h.token}
                label={`Stabilo ${h.label}`}
                onClick={done(() => chain().setHighlight({ color: resolveToken(h.token) }).run())}
                style={{ backgroundColor: `var(${h.token})` }}
              />
            ))}
          </div>
        </Popover>
      ) : null}

      {open === 'insert' ? (
        <Popover anchor={anchors.current.insert} onClose={() => setOpen(null)} label="Sisipkan">
          <MenuRow onClick={done(() => void lineToToggle(editor))}>Toggle (bisa dilipat)</MenuRow>
          <MenuRow onClick={done(() => chain().setHorizontalRule().run())}>Garis pemisah</MenuRow>
          <MenuRow onClick={done(() => chain().insertContent(stampText(new Date(), false)).run())}>
            Tanggal hari ini <span className="text-fg-faint">· {stampText(new Date(), false)}</span>
          </MenuRow>
          <MenuRow onClick={done(() => chain().insertContent(stampText(new Date(), true)).run())}>
            Tanggal dan jam <span className="text-fg-faint">· {stampText(new Date(), true)}</span>
          </MenuRow>
        </Popover>
      ) : null}
    </div>
  );
}

function Sep(): JSX.Element {
  return <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border" />;
}

function Tool({
  label,
  onClick,
  pressed,
  disabled = false,
  anchor,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  anchor?: (node: HTMLButtonElement | null) => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      ref={anchor}
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

/** A dropdown fixed under its button, outside the scrolling row. */
function Popover({
  anchor,
  onClose,
  label,
  children,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  label: string;
  children: ReactNode;
}): JSX.Element | null {
  const panel = useRef<HTMLDivElement | null>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = 248;
    const view = anchor.ownerDocument.defaultView ?? window;
    setPlace({ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, view.innerWidth - width - 8)) });
  }, [anchor]);

  useEffect(() => {
    const onDown = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || anchor?.contains(target)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    const onScroll = (): void => onClose();
    // The anchor's document: the toolbar may be in the mini window (22 Oct 2026).
    const doc = anchor?.ownerDocument ?? document;
    doc.addEventListener('pointerdown', onDown);
    doc.addEventListener('keydown', onKey);
    (doc.defaultView ?? window).addEventListener('resize', onScroll);
    return () => {
      doc.removeEventListener('pointerdown', onDown);
      doc.removeEventListener('keydown', onKey);
      (doc.defaultView ?? window).removeEventListener('resize', onScroll);
    };
  }, [anchor, onClose]);

  if (!place) return null;
  return createPortal(
    <div
      ref={panel}
      role="menu"
      aria-label={label}
      style={{ top: place.top, left: place.left }}
      className="fixed z-[70] w-[248px] rounded-xl border border-border bg-surface p-1 shadow-pop"
    >
      {children}
    </div>,
    (anchor?.ownerDocument ?? document).body,
  );
}

function MenuRow({
  onClick,
  selected = false,
  children,
}: {
  onClick: () => void;
  selected?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`flex min-h-tap w-full items-center gap-1 rounded-lg px-3 text-left text-sm hover:bg-bg-subtle ${selected ? 'bg-bg-subtle font-semibold text-fg' : 'text-fg'}`}
    >
      {children}
    </button>
  );
}

function Swatch({
  label,
  onClick,
  style,
  crossed = false,
}: {
  label: string;
  onClick: () => void;
  style: React.CSSProperties;
  crossed?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="flex min-h-tap min-w-tap items-center justify-center rounded-lg hover:bg-bg-subtle"
    >
      <span aria-hidden="true" className="relative block h-6 w-6 rounded-full border border-border-strong" style={style}>
        {crossed ? <span className="absolute inset-0 flex items-center justify-center text-xs text-fg-muted">✕</span> : null}
      </span>
    </button>
  );
}
