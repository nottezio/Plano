import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

import { prepareLegacyHtml } from './legacyHtml';

/**
 * Put another device's version of the note into the editor (added 18 Oct
 * 2026), without it counting as an edit here — no `onUpdate`, so no save of
 * text this device did not write — and with the caret where it was, clamped
 * if the note got shorter.
 */
export function replaceContent(editor: Editor, html: string): void {
  const { from, to } = editor.state.selection;
  editor.commands.setContent(prepareLegacyHtml(html), { emitUpdate: false });
  const max = editor.state.doc.content.size;
  const clamp = (n: number): number => Math.max(0, Math.min(n, max));
  const { tr } = editor.state;
  try {
    tr.setSelection(TextSelection.create(tr.doc, clamp(from), clamp(to)));
  } catch {
    tr.setSelection(TextSelection.atEnd(tr.doc));
  }
  tr.setMeta('addToHistory', false).setMeta('preventUpdate', true);
  editor.view.dispatch(tr);
}
