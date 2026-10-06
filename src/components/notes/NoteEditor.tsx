import { useCallback, useEffect, useRef, useState } from 'react';

import { IconBack, IconMore, IconPin } from '@/components/common/Icons';
import { ConflictDialog } from '@/components/patient/ConflictDialog';
import { patchScratchNote } from '@/data/repositories/scratchNotes.repo';
import { COLOR_SENTINEL, stripSentinelColor } from '@/domain/format/noteColor';
import { displayTitle, relativeTime, type ResolvedNote } from '@/domain/notes/scratchNotes';
import { useTextSync } from '@/hooks/useTextSync';

import {
  listBackspace,
  listEnter,
  itemInCheckZone,
  joinSplitLists,
  normaliseChecklists,
  toggleChecklistLine,
  toggleItem,
  toggleItemAtCaret,
} from './checklistDom';

/**
 * One Catatan, open for editing.
 *
 * Rendered with `key={note.id}`, so switching notes is a fresh mount: the
 * title draft, the remembered selection and the text-sync draft can never
 * belong to the note you just left. `useTextSync` flushes on unmount.
 *
 * CHROME, KEPT TO TWO ROWS
 *
 * The old editor stacked shelf tabs, a back/title/archive/delete row and a
 * wrapping toolbar above the text — a third of a phone screen before a word.
 * Now: one header row (back on a phone, the title, pin, ⋯) that scrolls away,
 * and one toolbar row that stays, scrolling sideways rather than wrapping.
 * Archive, shelf and delete moved into ⋯: they are used once per note, not
 * once per line.
 */

const COLORS = [
  { label: 'Biasa', token: null },
  { label: 'Merah', token: '--note-red' },
  { label: 'Kuning', token: '--note-amber' },
  { label: 'Hijau', token: '--note-green' },
  { label: 'Biru', token: '--note-blue' },
] as const;

/**
 * `execCommand('foreColor')` takes a colour VALUE and bakes it into the stored
 * HTML; it cannot read a CSS variable. Resolved at click time from the token
 * layer, so the palette matches the theme it was applied in.
 */
function resolveToken(token: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value || 'currentColor';
}

const SIZES = [
  { label: 'Kecil', value: '2' },
  { label: 'Normal', value: '3' },
  { label: 'Besar', value: '5' },
];

export function NoteEditor({
  uid,
  note,
  now,
  autoFocus = false,
  onBack,
  onMenu,
}: {
  uid: string | null;
  note: ResolvedNote;
  now: number;
  /** A note just created: put the caret in it. */
  autoFocus?: boolean;
  /** Phone only: back to the list. Absent in the two-pane layout. */
  onBack?: (() => void) | undefined;
  onMenu: () => void;
}): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);
  const noteRef = useRef(note);
  noteRef.current = note;
  const trashed = note.deletedAt !== undefined;
  const autoFocusRef = useRef(autoFocus);

  const write = useCallback(
    (body: string) =>
      uid ? patchScratchNote(uid, noteRef.current, { body }) : Promise.resolve(),
    [uid],
  );

  const sync = useTextSync({
    key: `scratch|${uid ?? 'none'}|${note.id}`,
    serverText: note.body,
    // A note in Sampah is read-only until restored: edits there would be
    // edits nobody can find.
    locked: uid === null || trashed,
    write,
  });
  const syncRef = useRef(sync);
  syncRef.current = sync;

  /** Push the DOM's current HTML into the sync draft. */
  const commitDom = useCallback(() => {
    const node = ref.current;
    if (node) syncRef.current.setValue(node.innerHTML);
  }, []);

  // ── Title: local while typing, written on a pause or on blur ───────────────
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const titleTimer = useRef<number | undefined>(undefined);
  const commitTitle = useCallback(
    (title: string) => {
      if (!uid) return;
      void patchScratchNote(uid, noteRef.current, { title }).catch((error: unknown) =>
        console.error('[catatan] rename rejected', error),
      );
    },
    [uid],
  );
  const onTitle = (title: string): void => {
    setTitleDraft(title);
    window.clearTimeout(titleTimer.current);
    titleTimer.current = window.setTimeout(() => {
      commitTitle(title);
      setTitleDraft(null);
    }, 400);
  };
  const flushTitle = (): void => {
    if (titleDraft === null) return;
    window.clearTimeout(titleTimer.current);
    commitTitle(titleDraft);
    setTitleDraft(null);
  };
  // Leaving the note mid-rename still saves the rename.
  const titleDraftRef = useRef(titleDraft);
  titleDraftRef.current = titleDraft;
  useEffect(
    () => () => {
      window.clearTimeout(titleTimer.current);
      if (titleDraftRef.current !== null) commitTitle(titleDraftRef.current);
    },
    [commitTitle],
  );

  // ── Selection memory, so toolbar controls act on what was selected ─────────
  /*
    Opening the size <select> (or tapping a toolbar button on a phone) moves
    focus off the editor, and the browser may drop the selection with it.
    Recorded from `selectionchange` so keyboard selections count too.
  */
  const lastRange = useRef<Range | null>(null);
  useEffect(() => {
    const onSelectionChange = (): void => {
      const node = ref.current;
      const selection = window.getSelection();
      if (!node || !selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (!node.contains(range.commonAncestorContainer)) return;
      lastRange.current = range.cloneRange();
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  const restoreSelection = (): void => {
    const node = ref.current;
    const range = lastRange.current;
    if (!node) return;
    node.focus({ preventScroll: true });
    if (!range || !node.contains(range.commonAncestorContainer)) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  // ── Native listeners, bound to the node's lifetime (pattern 11) ───────────
  /*
    Ctrl/Cmd+Enter ticks a row: a shortcut, so `keydown` is right for it.
  */
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const node = ref.current;
      if (!node || event.isComposing) return;
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && toggleItemAtCaret(node)) {
        event.preventDefault();
        commitDom();
      }
    },
    [commitDom],
  );

  /*
    Enter and Backspace in a list, from `beforeinput`, not `keydown`.

    `keydown` is a KEY: phone keyboards report Backspace as "Unidentified" and
    skip it entirely while a word is being composed, so the list rules ran on
    a laptop and silently did not on a phone, where the browser's own handling
    took over. `beforeinput` is the EDIT the keyboard is about to make, which
    every keyboard reports. Only cancelable events are taken: where a browser
    will not let the edit be cancelled, doing ours as well would do it twice.
  */
  const onBeforeInput = useCallback(
    (event: InputEvent) => {
      const node = ref.current;
      if (!node || event.isComposing || !event.cancelable) return;
      let handled = false;
      if (event.inputType === 'insertParagraph') handled = listEnter(node);
      else if (event.inputType === 'deleteContentBackward') handled = listBackspace(node);
      if (handled) {
        event.preventDefault();
        commitDom();
      }
    },
    [commitDom],
  );

  /*
    The box is hit on POINTERDOWN, and the default is prevented there, so the
    tap neither moves the caret nor — on a phone — raises the keyboard just to
    tick a row. `touchstart` is prevented separately: it must be a non-passive
    native listener, which React cannot register.
  */
  const onPointerDown = useCallback(
    (event: PointerEvent) => {
      const node = ref.current;
      if (!node || node.getAttribute('contenteditable') !== 'true') return;
      const li = itemInCheckZone(node, event.target, event.clientX);
      if (!li) return;
      event.preventDefault();
      toggleItem(li);
      commitDom();
    },
    [commitDom],
  );
  const onTouchStart = useCallback((event: TouchEvent) => {
    const node = ref.current;
    const touch = event.touches[0];
    if (!node || !touch) return;
    if (itemInCheckZone(node, event.target, touch.clientX)) event.preventDefault();
  }, []);

  /*
    Paste as plain text. Rich paste from WhatsApp Web or a lab portal brought
    its own fonts, tables and inline styles into the note, and a pasted <li>
    or <input> could land inside a checklist row and break it.
  */
  const onPaste = useCallback(
    (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text/plain');
      if (text === undefined) return;
      event.preventDefault();
      document.execCommand('insertText', false, text);
      commitDom();
    },
    [commitDom],
  );

  const attachEditor = useCallback(
    (node: HTMLDivElement | null) => {
      const previous = ref.current;
      if (previous && previous !== node) {
        previous.removeEventListener('keydown', onKeyDown);
        previous.removeEventListener('beforeinput', onBeforeInput);
        previous.removeEventListener('pointerdown', onPointerDown);
        previous.removeEventListener('touchstart', onTouchStart);
        previous.removeEventListener('paste', onPaste);
      }
      ref.current = node;
      if (!node) return;
      const value = syncRef.current.value;
      if (node.innerHTML !== value) node.innerHTML = value;
      // Old <input> checklists become drawn boxes. Not saved until the next
      // edit: opening a note must not write to it.
      normaliseChecklists(node);
      if (node !== previous) {
        node.addEventListener('keydown', onKeyDown);
        node.addEventListener('beforeinput', onBeforeInput);
        node.addEventListener('pointerdown', onPointerDown);
        node.addEventListener('touchstart', onTouchStart, { passive: false });
        node.addEventListener('paste', onPaste);
        if (autoFocusRef.current) {
          autoFocusRef.current = false;
          node.focus();
        }
      }
    },
    [onKeyDown, onBeforeInput, onPointerDown, onTouchStart, onPaste],
  );

  /*
    A remote change (another device) replaces the DOM — only when the two have
    actually diverged, or every keystroke would reset the caret.
  */
  useEffect(() => {
    const node = ref.current;
    if (node && node.innerHTML !== sync.value) {
      node.innerHTML = sync.value;
      normaliseChecklists(node);
    }
  }, [sync.value]);

  // ── Toolbar actions ─────────────────────────────────────────────────────────
  const apply = (command: string, value?: string): void => {
    restoreSelection();
    // Deprecated, and still the only thing that does this without owning a
    // document model. Its changes stay in the browser's undo stack.
    document.execCommand(command, false, value);
    commitDom();
  };

  const checklist = (): void => {
    const node = ref.current;
    if (!node) return;
    restoreSelection();
    toggleChecklistLine(node);
    commitDom();
  };

  const clearColor = (): void => {
    const node = ref.current;
    if (!node) return;
    restoreSelection();
    document.execCommand('foreColor', false, COLOR_SENTINEL);
    stripSentinelColor(node);
    commitDom();
  };

  const [showColors, setShowColors] = useState(false);

  const togglePin = (): void => {
    if (!uid) return;
    void patchScratchNote(uid, note, { pinned: !note.pinned }).catch((error: unknown) =>
      console.error('[catatan] pin rejected', error),
    );
  };

  const edited = relativeTime(note.updatedAt, now);

  return (
    <div className="flex min-h-full flex-col">
      {/* Row 1 — scrolls away once you are writing. */}
      <div className="flex items-center gap-1 px-2 pt-2">
        {onBack ? (
          <button
            type="button"
            aria-label="Kembali ke daftar"
            onClick={() => {
              sync.flush();
              flushTitle();
              onBack();
            }}
            className="flex min-h-tap min-w-tap shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-bg-subtle"
          >
            <IconBack />
          </button>
        ) : null}
        <input
          type="text"
          value={titleDraft ?? note.title}
          onChange={(event) => onTitle(event.target.value)}
          onBlur={flushTitle}
          onKeyDown={(event) => {
            // Enter in the title moves into the note, like every notes app.
            if (event.key === 'Enter') {
              event.preventDefault();
              flushTitle();
              ref.current?.focus();
            }
          }}
          readOnly={trashed}
          aria-label="Judul catatan"
          placeholder={displayTitle({ title: '', body: sync.value }) === 'Tanpa judul'
            ? 'Judul'
            : displayTitle({ title: '', body: sync.value })}
          className="min-h-tap min-w-0 flex-1 rounded-lg bg-transparent px-2 text-lg font-semibold outline-none placeholder:font-normal placeholder:text-fg-faint focus:bg-bg-subtle"
        />
        {!trashed ? (
          <button
            type="button"
            aria-label={note.pinned ? 'Lepas pin' : 'Pin'}
            aria-pressed={note.pinned === true}
            title={note.pinned ? 'Lepas pin' : 'Pin'}
            onClick={togglePin}
            className={[
              'flex min-h-tap min-w-tap shrink-0 items-center justify-center rounded-lg hover:bg-bg-subtle',
              note.pinned ? 'text-accent' : 'text-fg-faint',
            ].join(' ')}
          >
            <IconPin filled={note.pinned === true} />
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Menu catatan"
          onClick={() => {
            sync.flush();
            flushTitle();
            onMenu();
          }}
          className="flex min-h-tap min-w-tap shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-bg-subtle"
        >
          <IconMore />
        </button>
      </div>

      {trashed ? (
        <p className="mx-3 mt-1 rounded-lg bg-bg-subtle px-3 py-2 text-xs text-fg-muted">
          Catatan ini ada di Sampah dan tidak bisa diubah. Pulihkan lewat menu ⋯.
        </p>
      ) : (
        /* Row 2 — stays. One line; scrolls sideways on a narrow phone. */
        <div
          role="toolbar"
          aria-label="Format"
          className="sticky top-0 z-10 flex items-center gap-0.5 overflow-x-auto border-b border-border bg-surface px-2"
        >
          <ToolButton label="Checklist" onClick={checklist}>
            <span aria-hidden="true" className="inline-block h-4 w-4 rounded border-2 border-current" />
          </ToolButton>
          <ToolButton label="Daftar berpoin" onClick={() => apply('insertUnorderedList')}>
            •≡
          </ToolButton>
          <ToolButton label="Tebal" onClick={() => apply('bold')}>
            <strong>B</strong>
          </ToolButton>
          <ToolButton label="Miring" onClick={() => apply('italic')}>
            <em>I</em>
          </ToolButton>
          <ToolButton label="Garis bawah" onClick={() => apply('underline')}>
            <span className="underline">U</span>
          </ToolButton>
          <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border" />
          {/*
            A command, not a state: reset to the label after applying, or the
            same size chosen twice in a row does nothing (no change event).
          */}
          <select
            aria-label="Ukuran teks"
            value="label"
            onChange={(event) => {
              apply('fontSize', event.target.value);
              event.target.value = 'label';
            }}
            className="min-h-tap shrink-0 rounded-lg bg-transparent px-1 text-xs text-fg-muted"
          >
            <option value="label" disabled>
              Ukuran
            </option>
            {SIZES.map((size) => (
              <option key={size.value} value={size.value}>
                {size.label}
              </option>
            ))}
          </select>
          <ToolButton
            label="Warna teks"
            pressed={showColors}
            onClick={() => setShowColors((current) => !current)}
          >
            <span className="font-semibold" style={{ color: 'var(--note-red)' }}>
              A
            </span>
          </ToolButton>
          {showColors
            ? COLORS.map((color) => (
                <ToolButton
                  key={color.label}
                  label={`Warna ${color.label}`}
                  onClick={() => {
                    if (color.token) apply('foreColor', resolveToken(color.token));
                    else clearColor();
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="h-5 w-5 rounded-full border border-border-strong"
                    style={{ backgroundColor: color.token ? `var(${color.token})` : 'var(--fg)' }}
                  />
                </ToolButton>
              ))
            : null}
        </div>
      )}

      <div
        ref={attachEditor}
        contentEditable={!trashed}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Isi catatan"
        spellCheck
        lang=""
        onInput={(event) => {
          // Lists the browser's own editing left split are joined, except
          // mid-composition, where moving nodes would break the keyboard's word.
          const node = ref.current;
          if (node && !(event.nativeEvent as InputEvent).isComposing) joinSplitLists(node);
          commitDom();
        }}
        onBlur={sync.flush}
        className="note-editor min-h-[60vh] flex-1 px-4 py-3 text-[15px] leading-7 outline-none"
      />

      <p className="px-4 pb-3 text-[11px] text-fg-faint">
        {sync.dirty ? 'Menyimpan…' : 'Tersimpan'}
        {edited ? ` · diubah ${edited}` : ''}
        {!trashed ? (
          <span className="hidden lg:inline"> · Ctrl+Enter mencentang baris checklist</span>
        ) : null}
      </p>

      {sync.conflict ? (
        <ConflictDialog
          conflict={sync.conflict}
          otherDeviceLabel="perangkat lain"
          onResolve={sync.resolveConflict}
        />
      ) : null}
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      // Keep the selection in the note: a button press must not take focus.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={[
        'flex min-h-tap min-w-tap shrink-0 items-center justify-center rounded-lg text-sm hover:bg-bg-subtle',
        pressed ? 'bg-bg-subtle text-fg' : 'text-fg-muted',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
