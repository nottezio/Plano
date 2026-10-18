// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/core';

import { filterSlash, SLASH_ITEMS } from './slash';
import { replaceContent } from './syncBridge';
import { LEGACY_FIXTURES, makeEditor, type } from './testEditor';

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

const ids = (q: string): string[] => filterSlash(q).map((i) => i.id);

describe('filterSlash', () => {
  it('matches Indonesian labels and English aliases', () => {
    expect(ids('che')).toEqual(['checklist']);
    expect(ids('todo')).toEqual(['checklist']);
    expect(ids('judul')).toEqual(['h1', 'h2', 'h3']);
    expect(ids('bullet')).toEqual(['bullet']);
    expect(ids('')).toHaveLength(8);
    expect(ids('zzz')).toEqual([]);
  });

  it('labels are exactly the spec’s', () => {
    expect(SLASH_ITEMS.map((i) => i.label)).toEqual([
      'Teks', 'Judul 1', 'Judul 2', 'Judul 3', 'Daftar berpoin', 'Daftar bernomor', 'Checklist', 'Pemisah',
    ]);
  });
});

describe('slash items run', () => {
  const cases: Array<[string, string]> = [
    ['text', 'paragraph'],
    ['h1', 'heading'],
    ['h2', 'heading'],
    ['h3', 'heading'],
    ['bullet', 'bulletList'],
    ['number', 'orderedList'],
    ['checklist', 'checklist'],
    ['divider', 'horizontalRule'],
  ];
  it.each(cases)('%s turns the block into %s and removes the typed /query', (id, nodeType) => {
    const ed = (editor = makeEditor(''));
    type(ed, 'x /ab');
    const to = ed.state.selection.from;
    const item = SLASH_ITEMS.find((i) => i.id === id);
    item?.run(ed, { from: to - 3, to });
    const types = (ed.getJSON().content ?? []).map((n) => n.type);
    expect(types).toContain(nodeType);
    expect(ed.getText()).not.toContain('/ab');
  });
});

describe('sync bridge', () => {
  it('replaces content without onUpdate', () => {
    const onUpdate = vi.fn();
    const ed = (editor = makeEditor('<p>lama</p>', { onUpdate }));
    replaceContent(ed, '<p>baru dari perangkat lain</p>');
    expect(ed.getText()).toContain('baru dari perangkat lain');
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('keeps the caret position', () => {
    const ed = (editor = makeEditor('<p>abcdef</p>'));
    ed.commands.setTextSelection(4);
    replaceContent(ed, '<p>abcdefgh</p>');
    expect(ed.state.selection.from).toBe(4);
  });

  it('clamps selection past the new end', () => {
    const ed = (editor = makeEditor('<p>abcdefghij</p>'));
    ed.commands.setTextSelection(10);
    expect(() => replaceContent(ed, '<p>ab</p>')).not.toThrow();
    expect(ed.state.selection.from).toBeLessThanOrEqual(ed.state.doc.content.size);
  });

  it('reads legacy markup on a remote replace too', () => {
    const ed = (editor = makeEditor(''));
    replaceContent(ed, LEGACY_FIXTURES.inputRows);
    expect(ed.getHTML()).toMatch(/<li data-checked="true">/);
  });
});

describe('opening never writes', () => {
  it('empty note: no write on open, first edit writes', () => {
    const onUpdate = vi.fn();
    const ed = (editor = makeEditor('', { onUpdate }));
    expect(onUpdate).not.toHaveBeenCalled();
    ed.commands.insertContent('a');
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it.each(Object.entries(LEGACY_FIXTURES))('opening the %s fixture fires no update', (_name, html) => {
    const onUpdate = vi.fn();
    editor = makeEditor(html, { onUpdate });
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
