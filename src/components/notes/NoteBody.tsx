import { useEffect, useRef, type ReactNode } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';

import { ConflictDialog } from '@/components/patient/ConflictDialog';
import { useTextSync } from '@/hooks/useTextSync';

import { prepareLegacyHtml } from './editor/legacyHtml';
import { noteExtensions } from './editor/schema';
import { SlashCommand } from './editor/slash';
import { slashRender } from './editor/SlashMenu';
import { replaceContent } from './editor/syncBridge';
import { Toolbar } from './editor/Toolbar';

/**
 * The body of a note: TipTap plus `useTextSync` (three-way merge, conflict
 * dialog). Split out of `NoteEditor` (24 Oct 2026) so the List Maker's shared
 * Catatan Visite writes with the same editor and the same merge; a hook and a
 * view, because `NoteEditor`'s header needs `sync` too (flush, placeholder).
 *
 * Sync rules (unchanged):
 *  - only a user edit saves (`onUpdate`); opening a note never writes it;
 *  - another device's version replaces the content quietly
 *    (`replaceContent`), unless it is the HTML this editor itself just sent.
 */
export function useNoteBody({
  syncKey,
  serverText,
  write,
  locked,
  autoFocus = false,
  ariaLabel = 'Isi catatan',
}: {
  syncKey: string;
  serverText: string;
  write: (body: string) => Promise<void>;
  locked: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
}) {
  const sync = useTextSync({ key: syncKey, serverText, locked, write });
  const syncRef = useRef(sync);
  syncRef.current = sync;

  /** The last HTML this editor sent, so its own echo is not "a remote change". */
  const lastSent = useRef(sync.value);
  const editable = !locked;

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
        'aria-label': ariaLabel,
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

  return { editor, sync, editable };
}

export function NoteBodyView({
  editor,
  sync,
  editable,
  notice,
  footer,
}: {
  editor: Editor | null;
  sync: ReturnType<typeof useTextSync>;
  editable: boolean;
  /** Shown instead of the toolbar when the note cannot be edited. */
  notice?: ReactNode;
  /** After "Tersimpan" ("· diubah 5 mnt"). */
  footer?: ReactNode;
}): JSX.Element {
  return (
    <>
      {!editable ? notice ?? null : editor ? <Toolbar editor={editor} /> : null}

      <div className="flex-1">
        <EditorContent editor={editor} />
      </div>

      <p className="px-4 pb-3 text-xs text-fg-faint">
        {sync.dirty ? 'Menyimpan…' : 'Tersimpan'}
        {footer}
        {editable ? <span className="hidden lg:inline"> · Ketik / untuk pilihan · Ctrl+Enter mencentang</span> : null}
      </p>

      {sync.conflict ? (
        <ConflictDialog conflict={sync.conflict} otherDeviceLabel="perangkat lain" onResolve={sync.resolveConflict} />
      ) : null}
    </>
  );
}
