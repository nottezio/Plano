import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';

import { IconBack, IconMore, IconPin } from '@/components/common/Icons';
import { ConflictDialog } from '@/components/patient/ConflictDialog';
import { patchScratchNote } from '@/data/repositories/scratchNotes.repo';
import { displayTitle, relativeTime, type ResolvedNote } from '@/domain/notes/scratchNotes';
import { useTextSync } from '@/hooks/useTextSync';

import { sinkDone } from './editor/commands';
import { prepareLegacyHtml } from './editor/legacyHtml';
import { noteExtensions } from './editor/schema';
import { SlashCommand } from './editor/slash';
import { slashRender } from './editor/SlashMenu';
import { replaceContent } from './editor/syncBridge';
import { Toolbar } from './editor/Toolbar';

/**
 * One Catatan, open for editing.
 *
 * Rendered with `key={note.id}`, so switching notes is a fresh mount: the
 * title draft and the text-sync draft can never belong to the note you just
 * left. `useTextSync` flushes on unmount.
 *
 * THE BODY (rebuilt 18 Oct 2026). A TipTap (ProseMirror) editor replaced the
 * contentEditable + execCommand box, whose list behaviour was repaired after
 * the fact in checklistDom. The schema writes the same HTML as before
 * (`editor/schema.ts`), so storage, search and previews are unchanged.
 *
 * Sync rules:
 *  - only a user edit saves (`onUpdate`); opening a note never writes it;
 *  - another device's version replaces the content quietly
 *    (`replaceContent`), unless it is the HTML this editor itself just sent.
 *
 * CHROME, KEPT TO TWO ROWS: header (back, title, pin, ⋯) that scrolls away,
 * and the toolbar that stays.
 */

/** Actions the page's ⋯ menu can offer for the open note. */
export interface NoteMenuActions {
  /** "Pindahkan yang selesai ke bawah"; null when nothing would move. */
  sinkDone: (() => void) | null;
}

export function NoteEditor({
  uid,
  note,
  now,
  autoFocus = false,
  onBack,
  onMenu,
  onPopOut,
}: {
  uid: string | null;
  note: ResolvedNote;
  now: number;
  /** A note just created: put the caret in it. */
  autoFocus?: boolean;
  /** Phone only: back to the list. Absent in the two-pane layout. */
  onBack?: (() => void) | undefined;
  onMenu: (actions: NoteMenuActions) => void;
  /** Open this note in the small window (desktop). Absent inside that window. */
  onPopOut?: (() => void) | undefined;
}): JSX.Element {
  const noteRef = useRef(note);
  noteRef.current = note;
  const trashed = note.deletedAt !== undefined;

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

  /** The last HTML this editor sent, so its own echo is not "a remote change". */
  const lastSent = useRef(sync.value);
  const editable = !trashed && uid !== null;

  const editor = useEditor({
    extensions: [...noteExtensions(), SlashCommand.configure({ render: slashRender })],
    content: prepareLegacyHtml(sync.value),
    editable,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        class: 'note-editor min-h-[60vh] px-4 py-3 text-[15px] leading-7 outline-none',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Isi catatan',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      lastSent.current = html;
      syncRef.current.setValue(html);
    },
    onBlur: () => syncRef.current.flush(),
  });

  // Another device's version: replace quietly, keep the caret.
  useEffect(() => {
    if (!editor || sync.value === lastSent.current) return;
    lastSent.current = sync.value;
    replaceContent(editor, sync.value);
  }, [editor, sync.value]);

  useEffect(() => {
    editor?.setEditable(editable, false);
  }, [editor, editable]);

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
              editor?.commands.focus('start');
            }
          }}
          readOnly={trashed}
          aria-label="Judul catatan"
          placeholder={displayTitle({ title: '', body: sync.value }) === 'Tanpa judul'
            ? 'Judul'
            : displayTitle({ title: '', body: sync.value })}
          className="min-h-tap min-w-0 flex-1 rounded-lg bg-transparent px-2 text-lg font-semibold outline-none placeholder:font-normal placeholder:text-fg-faint focus:bg-bg-subtle"
        />
        {onPopOut && !trashed ? (
          <button
            type="button"
            aria-label="Buka di jendela kecil"
            title="Buka di jendela kecil (tetap di atas SIMGOS)"
            onClick={() => {
              sync.flush();
              flushTitle();
              onPopOut();
            }}
            className="flex min-h-tap min-w-tap shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-bg-subtle"
          >
            <span aria-hidden="true" className="text-base">⧉</span>
          </button>
        ) : null}
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
            onMenu({
              sinkDone:
                editor && editable && sinkDone(editor.state)
                  ? () => editor.commands.command(({ state, dispatch }) => sinkDone(state, dispatch))
                  : null,
            });
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
      ) : editor ? (
        <Toolbar editor={editor} />
      ) : null}

      <div className="flex-1">
        <EditorContent editor={editor} />
      </div>

      <p className="px-4 pb-3 text-xs text-fg-faint">
        {sync.dirty ? 'Menyimpan…' : 'Tersimpan'}
        {edited ? ` · diubah ${edited}` : ''}
        {!trashed ? (
          <span className="hidden lg:inline"> · Ketik / untuk pilihan · Ctrl+Enter mencentang</span>
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
