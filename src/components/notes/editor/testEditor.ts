import { Editor } from '@tiptap/core';

import { prepareLegacyHtml } from './legacyHtml';
import { noteExtensions } from './schema';

/**
 * Test helper (not a test): an editor on a detached node, with the same
 * extensions and the same legacy preprocessing NoteEditor uses.
 */
export function makeEditor(
  html: string,
  opts: { editable?: boolean; onUpdate?: () => void } = {},
): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  return new Editor({
    element,
    extensions: noteExtensions(),
    content: prepareLegacyHtml(html),
    editable: opts.editable ?? true,
    ...(opts.onUpdate ? { onUpdate: opts.onUpdate } : {}),
  });
}

/** Every shape of stored note the old editor could have written. */
export const LEGACY_FIXTURES = {
  current: '<ul class="cl"><li data-checked="true">a</li><li data-checked="false">b</li></ul>',
  inputRows:
    '<ul class="cl"><li><input type="checkbox" contenteditable="false" checked="">&nbsp;a</li>' +
    '<li><input type="checkbox" contenteditable="false">b</li></ul>',
  divLines: '<div>satu</div><div>dua<br>tiga</div>',
  colour: '<font color="#cc0000">x</font> <span style="color: rgb(204, 0, 0)">y</span>',
  size: '<font size="5">besar</font> biasa',
  mixed: '<ul><li>a</li></ul><ol><li>b</li></ol><div><b>c</b> <i>d</i> <u>e</u></div>',
  plain: 'teks biasa tanpa tag',
} as const;

/** Type `text` one character at a time, through input rules, like a keyboard. */
export function type(editor: Editor, text: string): void {
  for (const char of text) {
    const { view } = editor;
    const { from, to } = view.state.selection;
    const handled = view.someProp('handleTextInput', (f) => f(view, from, to, char, () => view.state.tr));
    if (!handled) view.dispatch(view.state.tr.insertText(char, from, to));
  }
}

/** Paste plain (and optionally HTML) text through the editor's paste handling. */
export function paste(editor: Editor, text: string, html?: string): boolean {
  const { view } = editor;
  const event = {
    clipboardData: { getData: (kind: string) => (kind === 'text/plain' ? text : kind === 'text/html' ? (html ?? '') : '') },
    preventDefault: () => undefined,
  } as unknown as ClipboardEvent;
  return view.someProp('handlePaste', (f) => f(view, event, view.state.doc.slice(0, 0))) === true;
}

/** Press a key the way a keyboard does (through handleKeyDown). `key` like 'Enter', 'Shift-Tab', 'Mod-Enter'. */
export function press(editor: Editor, key: string): void {
  const parts = key.split('-');
  const name = parts.pop() ?? key;
  const event = new KeyboardEvent('keydown', {
    key: name,
    shiftKey: parts.includes('Shift'),
    ctrlKey: parts.includes('Mod') || parts.includes('Ctrl'),
    bubbles: true,
    cancelable: true,
  });
  const { view } = editor;
  view.someProp('handleKeyDown', (f) => f(view, event));
}
