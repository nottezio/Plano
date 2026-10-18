// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/core';

import { handleTickPointer, toggleChecklistAt } from './commands';
import { makeEditor } from './testEditor';

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

const HTML = '<ul class="cl"><li data-checked="false"><p>obat</p></li></ul>';

/** Position of the first checklistItem node. */
function itemPos(ed: Editor): number {
  let pos = -1;
  ed.state.doc.descendants((node, at) => {
    if (pos === -1 && node.type.name === 'checklistItem') pos = at;
  });
  return pos;
}
const checked = (ed: Editor): unknown => ed.state.doc.nodeAt(itemPos(ed))?.attrs['checked'];

function pointerAtBox(ed: Editor): PointerEvent {
  const li = ed.view.dom.querySelector('ul.cl > li');
  const event = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 4 });
  Object.defineProperty(event, 'target', { value: li });
  return event as PointerEvent;
}

describe('ticking', () => {
  it('toggle flips checked and nothing else', () => {
    editor = makeEditor(HTML);
    const ed = editor;
    expect(ed.commands.command(({ state, dispatch }) => toggleChecklistAt(itemPos(ed))(state, dispatch))).toBe(true);
    expect(checked(ed)).toBe(true);
    ed.commands.command(({ state, dispatch }) => toggleChecklistAt(itemPos(ed))(state, dispatch));
    expect(checked(ed)).toBe(false);
    expect(ed.getText().trim()).toBe('obat');
  });

  it('a press on the box ticks it and is consumed', () => {
    editor = makeEditor(HTML);
    const event = pointerAtBox(editor);
    expect(handleTickPointer(editor.view, event)).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(checked(editor)).toBe(true);
  });

  it('toggle does nothing when not editable', () => {
    const onUpdate = vi.fn();
    editor = makeEditor(HTML, { editable: false, onUpdate });
    expect(handleTickPointer(editor.view, pointerAtBox(editor))).toBe(false);
    expect(checked(editor)).toBe(false);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('Mod-Enter toggles the item at the caret', () => {
    editor = makeEditor(HTML);
    editor.commands.setTextSelection(itemPos(editor) + 3);
    editor.commands.keyboardShortcut('Mod-Enter');
    expect(checked(editor)).toBe(true);
  });
});
