// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import {
  checklistBackspace,
  checklistEnter,
  normaliseChecklists,
  toggleChecklistLine,
  toggleItem,
  toggleItemAtCaret,
} from './checklistDom';

let root: HTMLDivElement;

beforeEach(() => {
  document.body.innerHTML = '';
  root = document.createElement('div');
  root.contentEditable = 'true';
  document.body.appendChild(root);
});

/** Put the caret `offset` characters into the first text node containing `text`. */
function caretIn(text: string, offset: number): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent?.includes(text)) {
      const range = document.createRange();
      range.setStart(node, node.textContent.indexOf(text) + offset);
      range.collapse(true);
      document.getSelection()?.removeAllRanges();
      document.getSelection()?.addRange(range);
      return;
    }
  }
  throw new Error(`no text ${text}`);
}

function caretAt(node: Node, offset: number): void {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
}

/** Type at the caret, to prove where it ended up. */
function type(text: string): void {
  const range = document.getSelection()!.getRangeAt(0);
  range.insertNode(document.createTextNode(text));
}

describe('normaliseChecklists', () => {
  it('converts the old <input> rows and keeps their state', () => {
    root.innerHTML =
      '<ul class="cl"><li><input type="checkbox" contenteditable="false" checked="">&nbsp;EKG</li>' +
      '<li><input type="checkbox" contenteditable="false">&nbsp;</li></ul>';
    expect(normaliseChecklists(root)).toBe(true);
    expect(root.innerHTML).toBe(
      '<ul class="cl"><li data-checked="true">EKG</li><li data-checked="false"><br></li></ul>',
    );
  });

  it('gives a stateless row (made by the old Enter) a box', () => {
    root.innerHTML = '<ul class="cl"><li>Lab</li></ul>';
    normaliseChecklists(root);
    expect(root.innerHTML).toBe('<ul class="cl"><li data-checked="false">Lab</li></ul>');
  });

  it('leaves current markup and bullet lists alone', () => {
    root.innerHTML = '<ul class="cl"><li data-checked="true">a</li></ul><ul><li>b</li></ul>';
    expect(normaliseChecklists(root)).toBe(false);
  });
});

describe('checklistEnter', () => {
  it('splits a row at the caret into a new unticked row', () => {
    root.innerHTML = '<ul class="cl"><li data-checked="true">EKG ulang</li></ul>';
    caretIn('EKG ulang', 3);
    expect(checklistEnter(root)).toBe(true);
    expect(root.innerHTML).toBe(
      '<ul class="cl"><li data-checked="true">EKG</li><li data-checked="false"> ulang</li></ul>',
    );
    type('X');
    expect(root.querySelectorAll('li')[1]?.textContent).toBe('X ulang');
  });

  it('at the end of a row makes an empty row with the caret in it', () => {
    root.innerHTML = '<ul class="cl"><li data-checked="false">Lab</li></ul>';
    caretIn('Lab', 3);
    checklistEnter(root);
    expect(root.innerHTML).toBe(
      '<ul class="cl"><li data-checked="false">Lab</li><li data-checked="false"><br></li></ul>',
    );
    type('Echo');
    expect(root.querySelectorAll('li')[1]?.textContent).toBe('Echo');
  });

  it('in an empty row, ends the list', () => {
    root.innerHTML =
      '<ul class="cl"><li data-checked="false">Lab</li><li data-checked="false"><br></li></ul>';
    caretAt(root.querySelectorAll('li')[1]!, 0);
    checklistEnter(root);
    expect(root.innerHTML).toBe('<ul class="cl"><li data-checked="false">Lab</li></ul><div><br></div>');
  });

  it('an empty row in the middle splits the list around the new line', () => {
    root.innerHTML =
      '<ul class="cl"><li data-checked="false">a</li><li data-checked="false"><br></li>' +
      '<li data-checked="true">b</li></ul>';
    caretAt(root.querySelectorAll('li')[1]!, 0);
    checklistEnter(root);
    expect(root.innerHTML).toBe(
      '<ul class="cl"><li data-checked="false">a</li></ul><div><br></div>' +
        '<ul class="cl"><li data-checked="true">b</li></ul>',
    );
  });

  it('does nothing outside a checklist', () => {
    root.innerHTML = '<div>halo</div>';
    caretIn('halo', 2);
    expect(checklistEnter(root)).toBe(false);
    expect(root.innerHTML).toBe('<div>halo</div>');
  });
});

describe('checklistBackspace', () => {
  it('at the start of a row turns it into a plain line', () => {
    root.innerHTML =
      '<ul class="cl"><li data-checked="false">a</li><li data-checked="false">b</li>' +
      '<li data-checked="false">c</li></ul>';
    caretIn('b', 0);
    expect(checklistBackspace(root)).toBe(true);
    expect(root.innerHTML).toBe(
      '<ul class="cl"><li data-checked="false">a</li></ul><div>b</div>' +
        '<ul class="cl"><li data-checked="false">c</li></ul>',
    );
  });

  it('anywhere else is left to the browser', () => {
    root.innerHTML = '<ul class="cl"><li data-checked="false">abc</li></ul>';
    caretIn('abc', 1);
    expect(checklistBackspace(root)).toBe(false);
  });
});

describe('toggleChecklistLine', () => {
  it('turns a <div> line into a row, keeping the caret', () => {
    root.innerHTML = '<div>satu</div><div>dua</div>';
    caretIn('dua', 1);
    toggleChecklistLine(root);
    expect(root.innerHTML).toBe('<div>satu</div><ul class="cl"><li data-checked="false">dua</li></ul>');
    type('X');
    expect(root.querySelector('li')?.textContent).toBe('dXua');
  });

  it('turns a bare text line (between <br>s) into a row', () => {
    root.innerHTML = 'satu<br>dua<br>tiga';
    caretIn('dua', 0);
    toggleChecklistLine(root);
    expect(root.innerHTML).toBe('satu<br><ul class="cl"><li data-checked="false">dua</li></ul>tiga');
  });

  it('joins the row onto a checklist right above it', () => {
    root.innerHTML = '<ul class="cl"><li data-checked="false">a</li></ul><div>b</div>';
    caretIn('b', 1);
    toggleChecklistLine(root);
    expect(root.innerHTML).toBe(
      '<ul class="cl"><li data-checked="false">a</li><li data-checked="false">b</li></ul>',
    );
  });

  it('on a row, turns it back into a line', () => {
    root.innerHTML = '<ul class="cl"><li data-checked="true">a</li></ul>';
    caretIn('a', 1);
    toggleChecklistLine(root);
    expect(root.innerHTML).toBe('<div>a</div>');
  });

  it('in a bullet list, converts the whole list', () => {
    root.innerHTML = '<ul><li>a</li><li>b</li></ul>';
    caretIn('b', 0);
    toggleChecklistLine(root);
    expect(root.innerHTML).toBe(
      '<ul class="cl"><li data-checked="false">a</li><li data-checked="false">b</li></ul>',
    );
  });

  it('with no caret in the note, adds a row at the end', () => {
    root.innerHTML = '<div>x</div>';
    document.getSelection()?.removeAllRanges();
    toggleChecklistLine(root);
    expect(root.innerHTML).toBe('<div>x</div><ul class="cl"><li data-checked="false"><br></li></ul>');
  });

  it('in an empty editor, starts a list', () => {
    caretAt(root, 0);
    toggleChecklistLine(root);
    expect(root.innerHTML).toBe('<ul class="cl"><li data-checked="false"><br></li></ul>');
  });
});

describe('ticking', () => {
  it('toggleItem flips the state', () => {
    root.innerHTML = '<ul class="cl"><li data-checked="false">a</li></ul>';
    const li = root.querySelector('li')!;
    toggleItem(li);
    expect(li.getAttribute('data-checked')).toBe('true');
    toggleItem(li);
    expect(li.getAttribute('data-checked')).toBe('false');
  });

  it('Ctrl+Enter ticks the row the caret is in', () => {
    root.innerHTML = '<ul class="cl"><li data-checked="false">a</li></ul>';
    caretIn('a', 1);
    expect(toggleItemAtCaret(root)).toBe(true);
    expect(root.innerHTML).toBe('<ul class="cl"><li data-checked="true">a</li></ul>');
  });
});
