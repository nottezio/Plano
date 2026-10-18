// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { Editor, JSONContent } from '@tiptap/core';

import { LEGACY_FIXTURES, makeEditor } from './testEditor';

let editor: Editor | null = null;
const open = (html: string): Editor => (editor = makeEditor(html));
afterEach(() => {
  editor?.destroy();
  editor = null;
});

function find(json: JSONContent, type: string): JSONContent[] {
  const out: JSONContent[] = [];
  const walk = (node: JSONContent): void => {
    if (node.type === type) out.push(node);
    node.content?.forEach(walk);
  };
  walk(json);
  return out;
}

const marksOf = (json: JSONContent): string[] =>
  find(json, 'text').flatMap((t) => (t.marks ?? []).map((m) => m.type));

describe('note schema — reading stored HTML', () => {
  it('reads current checklist markup', () => {
    const items = find(open(LEGACY_FIXTURES.current).getJSON(), 'checklistItem');
    expect(items.map((i) => i.attrs?.['checked'])).toEqual([true, false]);
  });

  it('reads the oldest <input> rows', () => {
    const ed = open(LEGACY_FIXTURES.inputRows);
    const items = find(ed.getJSON(), 'checklistItem');
    expect(items.map((i) => i.attrs?.['checked'])).toEqual([true, false]);
    expect(items.map((i) => find(i, 'text').map((t) => t.text).join(''))).toEqual(['a', 'b']);
  });

  it('reads stateless rows as unticked', () => {
    const items = find(open('<ul class="cl"><li>a</li></ul>').getJSON(), 'checklistItem');
    expect(items.map((i) => i.attrs?.['checked'])).toEqual([false]);
  });

  it('keeps div and br lines', () => {
    const text = open(LEGACY_FIXTURES.divLines).getText({ blockSeparator: '\n' });
    expect(text.split('\n').map((l) => l.trim()).filter(Boolean)).toEqual(['satu', 'dua', 'tiga']);
  });

  it('keeps colour from <font color> and <span style>', () => {
    const json = open(LEGACY_FIXTURES.colour).getJSON();
    const colours = find(json, 'text').flatMap((t) =>
      (t.marks ?? []).filter((m) => m.type === 'textStyle').map((m) => m.attrs?.['color']),
    );
    expect(colours).toHaveLength(2);
    colours.forEach((c) => expect(c).toBeTruthy());
  });

  it('keeps legacy size', () => {
    const ed = open(LEGACY_FIXTURES.size);
    expect(ed.getHTML()).toMatch(/font-size:\s*1\.5em/);
  });

  it('bullets, numbers, b/i/u survive', () => {
    const json = open(LEGACY_FIXTURES.mixed).getJSON();
    expect(find(json, 'bulletList')).toHaveLength(1);
    expect(find(json, 'orderedList')).toHaveLength(1);
    expect(marksOf(json)).toEqual(expect.arrayContaining(['bold', 'italic', 'underline']));
  });
});

describe('note schema — writing HTML', () => {
  it('writes checklists as ul.cl > li[data-checked]', () => {
    const html = open(LEGACY_FIXTURES.current).getHTML();
    expect(html).toMatch(/<ul class="cl"><li data-checked="true">/);
    expect(html).not.toMatch(/data-type|<input/);
  });

  it('writes nested lists inside the li', () => {
    const html = open(
      '<ul class="cl"><li data-checked="false"><p>x</p><ul><li><p>y</p></li></ul></li></ul>',
    ).getHTML();
    expect(html).toBe(
      '<ul class="cl"><li data-checked="false"><p>x</p><ul><li><p>y</p></li></ul></li></ul>',
    );
  });
});
