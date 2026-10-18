// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { Editor } from '@tiptap/core';
import type { Command } from '@tiptap/pm/state';

import { moveBlock, sinkDone } from './commands';
import { makeEditor } from './testEditor';

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

const run = (ed: Editor, cmd: Command): boolean => cmd(ed.state, (tr) => ed.view.dispatch(tr));
const can = (ed: Editor, cmd: Command): boolean => cmd(ed.state);

/** Put the caret inside the first text node equal to `text`. */
function caretIn(ed: Editor, text: string): void {
  let at = -1;
  ed.state.doc.descendants((node, pos) => {
    if (at === -1 && node.isText && node.text === text) at = pos + 1;
  });
  ed.commands.setTextSelection(at);
}
const html = (ed: Editor): string => ed.getHTML().replace(/<p><\/p>$/, '');

describe('moveBlock', () => {
  it('moves a paragraph up and down', () => {
    const ed = (editor = makeEditor('<p>a</p><p>b</p><p>c</p>'));
    caretIn(ed, 'b');
    expect(run(ed, moveBlock('up'))).toBe(true);
    expect(html(ed)).toBe('<p>b</p><p>a</p><p>c</p>');
    run(ed, moveBlock('down'));
    run(ed, moveBlock('down'));
    expect(html(ed)).toBe('<p>a</p><p>c</p><p>b</p>');
  });

  it('returns false at the top and bottom', () => {
    const ed = (editor = makeEditor('<p>a</p><p>b</p>'));
    caretIn(ed, 'a');
    expect(can(ed, moveBlock('up'))).toBe(false);
    caretIn(ed, 'b');
    expect(can(ed, moveBlock('down'))).toBe(false);
  });

  it('moves a list item with its nested children', () => {
    const ed = (editor = makeEditor(
      '<ul><li><p>a</p></li><li><p>b</p><ul><li><p>b1</p></li></ul></li></ul>',
    ));
    caretIn(ed, 'b');
    run(ed, moveBlock('up'));
    expect(html(ed)).toBe('<ul><li><p>b</p><ul><li><p>b1</p></li></ul></li><li><p>a</p></li></ul>');
  });

  it('keeps the caret inside the moved item', () => {
    const ed = (editor = makeEditor('<ul><li><p>a</p></li><li><p>bb</p></li></ul>'));
    caretIn(ed, 'bb');
    run(ed, moveBlock('up'));
    expect(ed.state.selection.$from.parent.textContent).toBe('bb');
  });
});

describe('sinkDone', () => {
  it('orders ticked after unticked, keeps relative order, per level', () => {
    const ed = (editor = makeEditor(
      '<ul class="cl">' +
        '<li data-checked="true"><p>a</p></li>' +
        '<li data-checked="false"><p>b</p><ul class="cl">' +
        '<li data-checked="true"><p>b1</p></li><li data-checked="false"><p>b2</p></li></ul></li>' +
        '<li data-checked="true"><p>c</p></li>' +
        '<li data-checked="false"><p>d</p></li>' +
        '</ul>',
    ));
    expect(run(ed, sinkDone)).toBe(true);
    expect(html(ed)).toBe(
      '<ul class="cl">' +
        '<li data-checked="false"><p>b</p><ul class="cl">' +
        '<li data-checked="false"><p>b2</p></li><li data-checked="true"><p>b1</p></li></ul></li>' +
        '<li data-checked="false"><p>d</p></li>' +
        '<li data-checked="true"><p>a</p></li>' +
        '<li data-checked="true"><p>c</p></li>' +
        '</ul>',
    );
  });

  it('returns false when already sorted', () => {
    const ed = (editor = makeEditor(
      '<ul class="cl"><li data-checked="false"><p>a</p></li><li data-checked="true"><p>b</p></li></ul>',
    ));
    expect(can(ed, sinkDone)).toBe(false);
  });
});
