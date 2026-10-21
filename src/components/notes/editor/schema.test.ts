// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { Editor, JSONContent } from '@tiptap/core';

import { lineToToggle } from './commands';
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

describe('richer toolbar marks and blocks (19 Oct 2026)', () => {
  it('keeps strike, highlight and quote through a round trip', () => {
    const html =
      '<p><s>coret</s> <mark data-color="rgba(250, 204, 21, 0.4)" style="background-color: rgba(250, 204, 21, 0.4); color: inherit">stabilo</mark></p><blockquote><p>kutipan</p></blockquote>';
    const out = open(html).getHTML();
    expect(out).toMatch(/<s>coret<\/s>/);
    expect(out).toMatch(/<mark[^>]*background-color: rgba\(250, 204, 21, 0\.4\)[^>]*>stabilo<\/mark>/);
    expect(out).toMatch(/<blockquote><p>kutipan<\/p><\/blockquote>/);
  });
});

describe('toggle block (22 Oct 2026)', () => {
  it('turns a line into a toggle and keeps it through a round trip', async () => {
    const ed = open('<p>Lab kemarin</p>');
    ed.commands.setTextSelection(3);
    expect(lineToToggle(ed)).toBe(true);
    const html = ed.getHTML();
    expect(html).toMatch(/<details[^>]*><summary>Lab kemarin<\/summary><div data-type="detailsContent"><p><\/p><\/div><\/details>/);
    // Caret at the end of the title, ready to type or press Enter into the body.
    expect(ed.state.selection.$from.parent.type.name).toBe('detailsSummary');
    // Created open, so its body can be written into straight away (the view opens it on the next tick).
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(html).toMatch(/<details class="toggle" open="">/);
    expect(ed.view.dom.querySelector('[data-type="detailsContent"]')?.hasAttribute('hidden')).toBe(false);
    const again = open(html).getHTML();
    expect(again).toBe(html);
  });
});
