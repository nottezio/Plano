import { useEffect, useRef, useState, type ReactNode } from 'react';

import { normaliseBullets, restoreEmphasis } from '@/domain/format/markdownLite';
import type { SectionAlias } from '@/domain/types';
import { SNIPPETS } from '@/domain/format/snippets';

/**
 * SPEC F4 — the floating toolbar under the SOAP editor.
 *
 * REDESIGNED 2026-10-02. The old bar was a strip of bare glyphs (↶ ↷ B I •
 * 1.), a native select reading "Sisipkan…", and two cryptic buttons "Aa*" and
 * "•→-" that rewrote the whole note. Now:
 *
 *  - Three groups in one rounded, shadowed pill: history · text format ·
 *    insert / tools. Icons are drawn, each with a tooltip and aria-label.
 *  - "Sisipkan" is a real menu that opens UPWARD (the bar sits at the bottom
 *    of the editor) and shows what each block will insert — the EKG line
 *    with this patient's floor and the note's date.
 *  - The two whole-note rewrites live in a "Rapikan" menu with words, not
 *    symbols, so nobody presses them to find out what they do.
 *
 * Every control keeps the textarea's focus and selection (mousedown is
 * prevented), as before: losing the selection would make Bold act on nothing
 * and dismiss the phone keyboard.
 */
export function FormatToolbar({
  disabled,
  onBold,
  onItalic,
  onBullet,
  onNumbered,
  onInsertSnippet,
  snippetPreview,
  value,
  onReplace,
  aliases,
  history,
}: {
  disabled: boolean;
  /** Undo/redo for the note; absent where there is none. */
  history?:
    | { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean }
    | undefined;
  onBold: () => void;
  onItalic: () => void;
  onBullet: () => void;
  onNumbered: () => void;
  /** Absent for the jaga editor: an admission block does not belong there. */
  onInsertSnippet?: ((snippetId: string) => void) | undefined;
  /** What a snippet will insert, for the menu's second line. */
  snippetPreview?: ((snippetId: string) => string) | undefined;
  /** Current body, for the whole-note actions. */
  value: string;
  onReplace: (next: string) => void;
  /** The user's section aliases, so "Tebalkan judul" sees custom headings too. */
  aliases?: readonly SectionAlias[] | undefined;
}): JSX.Element {
  const [menu, setMenu] = useState<'insert' | 'tidy' | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setMenu(null);
    };
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMenu(null);
    };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('keydown', escape);
    };
  }, [menu]);

  return (
    <div ref={rootRef} className="relative w-fit max-w-full">
      <div
        role="toolbar"
        aria-label="Format catatan"
        className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-border bg-surface/95 p-0.5 shadow-lg backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {history ? (
          <Group>
            <Tool title="Undo (Ctrl+Z)" disabled={disabled || !history.canUndo} onClick={history.undo}>
              <Svg><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></Svg>
            </Tool>
            <Tool title="Redo (Ctrl+Shift+Z)" disabled={disabled || !history.canRedo} onClick={history.redo}>
              <Svg><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></Svg>
            </Tool>
          </Group>
        ) : null}

        <Group>
          <Tool title="Bold" disabled={disabled} onClick={onBold}>
            <span className="text-[15px] font-extrabold">B</span>
          </Tool>
          <Tool title="Italic" disabled={disabled} onClick={onItalic}>
            <span className="font-serif text-[15px] italic">I</span>
          </Tool>
          <Tool title="Bullet list" disabled={disabled} onClick={onBullet}>
            <Svg>
              <path d="M9 6h11M9 12h11M9 18h11" />
              <circle cx="4.5" cy="6" r="1" fill="currentColor" />
              <circle cx="4.5" cy="12" r="1" fill="currentColor" />
              <circle cx="4.5" cy="18" r="1" fill="currentColor" />
            </Svg>
          </Tool>
          <Tool title="Numbered list" disabled={disabled} onClick={onNumbered}>
            <Svg>
              <path d="M10 6h10M10 12h10M10 18h10" />
              <path d="M4 5h1.5v4M4 9h3M4 15.5c0-.8.7-1.5 1.5-1.5S7 14.7 7 15.5 4 18 4 19h3" />
            </Svg>
          </Tool>
        </Group>

        <Group last>
          {onInsertSnippet ? (
            <MenuButton
              label="Sisipkan"
              open={menu === 'insert'}
              disabled={disabled}
              onToggle={() => setMenu(menu === 'insert' ? null : 'insert')}
              icon={<Svg><path d="M12 5v14M5 12h14" /></Svg>}
            />
          ) : null}
          <MenuButton
            label="Rapikan"
            compactLabel
            open={menu === 'tidy'}
            disabled={disabled}
            onToggle={() => setMenu(menu === 'tidy' ? null : 'tidy')}
            icon={<Svg><path d="m4 20 10-10M14 4l1.5 3L19 8.5 15.5 10 14 13l-1.5-3L9 8.5 12.5 7z" /></Svg>}
          />
        </Group>
      </div>

      {menu === 'insert' && onInsertSnippet ? (
        <Menu>
          {SNIPPETS.map((snippet) => (
            <MenuItem
              key={snippet.id}
              label={snippet.label}
              detail={snippetPreview?.(snippet.id).split('\n')[0]}
              onClick={() => {
                onInsertSnippet(snippet.id);
                setMenu(null);
              }}
            />
          ))}
        </Menu>
      ) : null}

      {menu === 'tidy' ? (
        <Menu>
          <MenuItem
            label="Tebalkan semua judul bagian"
            detail="Mengembalikan *tebal* pada S, O, A, P, EKG, Lab… yang hilang saat ditempel"
            onClick={() => {
              onReplace(restoreEmphasis(value, aliases));
              setMenu(null);
            }}
          />
          <MenuItem
            label="Ubah • menjadi -"
            detail="Seragamkan tanda poin sebelum disalin"
            onClick={() => {
              onReplace(normaliseBullets(value));
              setMenu(null);
            }}
          />
        </Menu>
      ) : null}
    </div>
  );
}

function Group({ children, last = false }: { children: ReactNode; last?: boolean }): JSX.Element {
  return (
    <div className={['flex shrink-0 items-center gap-0.5', last ? '' : 'border-r border-border pr-0.5'].join(' ')}>
      {children}
    </div>
  );
}

function Svg({ children }: { children: ReactNode }): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function Tool({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="flex min-h-tap min-w-tap shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-bg-subtle hover:text-fg active:bg-[var(--accent-soft)] disabled:opacity-35 disabled:hover:bg-transparent [@media(pointer:fine)]:min-h-9 [@media(pointer:fine)]:min-w-9"
    >
      {children}
    </button>
  );
}

function MenuButton({
  label,
  icon,
  open,
  disabled,
  onToggle,
  compactLabel = false,
}: {
  label: string;
  /** Hide the word on a narrow phone (icon + tooltip only), so the bar fits. */
  compactLabel?: boolean;
  icon: ReactNode;
  open: boolean;
  disabled: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onToggle}
      className={[
        'flex min-h-tap shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-medium disabled:opacity-35 [@media(pointer:fine)]:min-h-9',
        open ? 'bg-[var(--accent-soft)] text-accent' : 'text-fg-muted hover:bg-bg-subtle hover:text-fg',
      ].join(' ')}
    >
      {icon}
      <span className={compactLabel ? 'hidden min-[420px]:inline' : ''}>{label}</span>
    </button>
  );
}

function Menu({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div
      role="menu"
      className="absolute bottom-full left-0 z-30 mb-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-2xl"
    >
      {children}
    </div>
  );
}

function MenuItem({
  label,
  detail,
  onClick,
}: {
  label: string;
  detail?: string | undefined;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="block min-h-tap w-full rounded-lg px-3 py-2 text-left hover:bg-bg-subtle"
    >
      <span className="block text-sm font-medium text-fg">{label}</span>
      {detail ? <span className="mt-0.5 block truncate font-mono text-[11px] text-fg-muted">{detail}</span> : null}
    </button>
  );
}
