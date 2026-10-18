// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { Editor, JSONContent } from '@tiptap/core';

import { makeEditor, paste, press, type } from './testEditor';

let editor: Editor | null = null;
const fresh = (html = ''): Editor => (editor = makeEditor(html));
afterEach(() => {
  editor?.destroy();
  editor = null;
});

const top = (ed: Editor): JSONContent[] => ed.getJSON().content ?? [];
const items = (ed: Editor, type = 'checklistItem'): JSONContent[] => {
  const out: JSONContent[] = [];
  const walk = (n: JSONContent): void => {
    if (n.type === type) out.push(n);
    n.content?.forEach(walk);
  };
  walk(ed.getJSON());
  return out;
};
const textOf = (n: JSONContent): string =>
  n.type === 'text' ? (n.text ?? '') : (n.content ?? []).map(textOf).join('');

describe('typing shortcuts', () => {
  it('[] + space makes an unticked item', () => {
    const ed = fresh();
    type(ed, '[] obat');
    expect(top(ed)[0]?.type).toBe('checklist');
    expect(items(ed).map((i) => [i.attrs?.['checked'], textOf(i)])).toEqual([[false, 'obat']]);
  });

  it('[x] makes a ticked item', () => {
    const ed = fresh();
    type(ed, '[x] lab');
    expect(items(ed).map((i) => [i.attrs?.['checked'], textOf(i)])).toEqual([[true, 'lab']]);
  });

  it('- makes a bullet', () => {
    const ed = fresh();
    type(ed, '- a');
    expect(top(ed)[0]?.type).toBe('bulletList');
  });

  it('1. makes a numbered list', () => {
    const ed = fresh();
    type(ed, '1. a');
    expect(top(ed)[0]?.type).toBe('orderedList');
  });

  it('## makes heading 2', () => {
    const ed = fresh();
    type(ed, '## Judul');
    expect(top(ed)[0]).toMatchObject({ type: 'heading', attrs: { level: 2 } });
  });

  it('--- makes a rule', () => {
    const ed = fresh();
    type(ed, '---');
    expect(top(ed).some((n) => n.type === 'horizontalRule')).toBe(true);
  });
});

describe('list keys', () => {
  it('Enter in a checklist adds an unticked item, even after a ticked one', () => {
    const ed = fresh();
    type(ed, '[x] a');
    press(ed, 'Enter');
    type(ed, 'b');
    expect(items(ed).map((i) => [i.attrs?.['checked'], textOf(i)])).toEqual([
      [true, 'a'],
      [false, 'b'],
    ]);
  });

  it('Enter on an empty item at top level leaves the list', () => {
    const ed = fresh();
    type(ed, '[] a');
    press(ed, 'Enter');
    press(ed, 'Enter');
    type(ed, 'teks');
    expect(items(ed)).toHaveLength(1);
    expect(top(ed)[1]).toMatchObject({ type: 'paragraph' });
    expect(textOf(top(ed)[1] ?? {})).toBe('teks');
  });

  it('Tab nests the item under the previous one; Shift-Tab lifts it', () => {
    const ed = fresh();
    type(ed, '[] a');
    press(ed, 'Enter');
    type(ed, 'b');
    press(ed, 'Tab');
    const parent = items(ed)[0];
    expect(items({ getJSON: () => parent ?? {} } as Editor)).toHaveLength(2); // a contains b
    press(ed, 'Shift-Tab');
    expect(top(ed)[0]?.content).toHaveLength(2);
  });

  it('Enter on an empty nested item lifts it one level', () => {
    const ed = fresh();
    type(ed, '- a');
    press(ed, 'Enter');
    type(ed, 'b');
    press(ed, 'Tab');
    press(ed, 'Enter');
    press(ed, 'Enter');
    type(ed, 'c');
    // c is a top-level item again, after a.
    expect((top(ed)[0]?.content ?? []).map(textOf)).toEqual(['ab', 'c']);
  });

  it('Backspace at the start of an item makes a paragraph', () => {
    const ed = fresh();
    type(ed, '[] a');
    ed.commands.setTextSelection(3); // start of "a"
    press(ed, 'Backspace');
    expect(top(ed)[0]).toMatchObject({ type: 'paragraph' });
    expect(textOf(top(ed)[0] ?? {})).toBe('a');
  });
});

describe('paste', () => {
  it('pasting lines into a checklist makes one item per line', () => {
    const ed = fresh();
    type(ed, '[] ');
    expect(paste(ed, 'a\nb\nc')).toBe(true);
    expect(items(ed).map((i) => [i.attrs?.['checked'], textOf(i)])).toEqual([
      [false, 'a'],
      [false, 'b'],
      [false, 'c'],
    ]);
  });

  it('paste drops HTML', () => {
    const ed = fresh();
    expect(paste(ed, 'x', '<table><tr><td>x</td></tr></table>')).toBe(true);
    expect(JSON.stringify(ed.getJSON())).not.toMatch(/table/);
    expect(ed.getText().trim()).toBe('x');
  });

  it('pasting lines outside a list makes paragraphs', () => {
    const ed = fresh();
    paste(ed, 'satu\ndua');
    expect(top(ed).map(textOf).filter(Boolean)).toEqual(['satu', 'dua']);
  });
});
