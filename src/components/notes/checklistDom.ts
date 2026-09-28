/**
 * Checklist editing inside the Catatan contenteditable.
 *
 * ROOT CAUSE OF THE OLD CLUNKINESS
 *
 * A checklist row used to be `<li><input type=checkbox contenteditable=false>`.
 * An <input> inside a contenteditable is a foreign object to the browser's
 * editing engine:
 *  - Enter split the <li> and left the box behind, so the next row had none —
 *    one box per toolbar press was the only way to build a list;
 *  - the caret could land beside the box instead of the text;
 *  - React never saw its clicks (pattern 4), so ticks needed native listeners
 *    and still depended on serialising an attribute rather than a property.
 *
 * NOW
 *
 * A row is `<li data-checked="true|false">` inside `ul.cl`. The box is drawn by
 * CSS (`.note-editor` in index.css), so the row holds only text and the editing
 * engine treats it like any other list item. The parts the browser gets wrong
 * for a list whose rows carry state — Enter, Backspace at the start, ticking —
 * are done here, on the DOM, and are tested against a real DOM (jsdom).
 *
 * Old notes are converted when they are opened (`normaliseChecklists`); the
 * stored HTML changes the next time the note is edited, not before.
 */

/** Width of the box's hit area, from the row's left edge. Matches the CSS. */
export const CHECK_ZONE_PX = 32;

const BLOCK_TAGS = new Set([
  'DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'UL', 'OL', 'TABLE', 'HR',
]);

const isElement = (node: Node | null | undefined): node is Element => node?.nodeType === 1;

const isChecklist = (node: Node | null | undefined): node is HTMLUListElement =>
  isElement(node) && node.tagName === 'UL' && node.classList.contains('cl');

function selectionIn(root: HTMLElement): Range | null {
  const selection = root.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  return root.contains(range.startContainer) ? range : null;
}

function placeCaret(node: Node, offset: number): void {
  const doc = node.ownerDocument;
  if (!doc) return;
  const range = doc.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const selection = doc.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/** The checklist row containing `node`, if any. */
export function checklistItemAt(root: HTMLElement, node: Node | null): HTMLLIElement | null {
  let current: Node | null = node;
  while (current && current !== root) {
    if (isElement(current) && current.tagName === 'LI' && isChecklist(current.parentNode)) {
      return current as HTMLLIElement;
    }
    current = current.parentNode;
  }
  return null;
}

const hasContent = (node: Node): boolean =>
  (node.textContent ?? '').replace(/ /g, ' ').trim() !== '' ||
  (isElement(node) && node.querySelector('img') !== null);

/** An empty block collapses to zero height; a <br> gives it a line. */
function fill(element: Element): void {
  if (!hasContent(element) && !element.querySelector('br')) {
    element.replaceChildren(element.ownerDocument.createElement('br'));
  }
}

/**
 * Convert old-style rows (an <input> inside the <li>) and any row without a
 * state to the current markup. Returns whether anything changed.
 */
export function normaliseChecklists(root: HTMLElement): boolean {
  let changed = false;
  root.querySelectorAll('ul.cl > li').forEach((li) => {
    const input = li.querySelector('input[type="checkbox"]');
    if (input) {
      li.setAttribute('data-checked', String(input.hasAttribute('checked')));
      input.remove();
      // The old insert put a non-breaking space after the box to type into.
      const first = li.firstChild;
      if (first && first.nodeType === 3) {
        first.textContent = (first.textContent ?? '').replace(/^[  ]/, '');
        if (!first.textContent) first.remove();
      }
      fill(li);
      changed = true;
    } else {
      const state = li.getAttribute('data-checked');
      if (state !== 'true' && state !== 'false') {
        li.setAttribute('data-checked', 'false');
        changed = true;
      }
    }
  });
  return changed;
}

export function toggleItem(li: Element): void {
  li.setAttribute('data-checked', li.getAttribute('data-checked') === 'true' ? 'false' : 'true');
}

/** The row whose BOX was hit — the padding to the left of its text. */
export function itemInCheckZone(
  root: HTMLElement,
  target: EventTarget | null,
  clientX: number,
): HTMLLIElement | null {
  const li = checklistItemAt(root, target as Node | null);
  if (!li || target !== li) return null;
  return clientX - li.getBoundingClientRect().left <= CHECK_ZONE_PX ? li : null;
}

/**
 * Take a row out of its list, splitting the list if the row was in the middle.
 * Returns where the row was, so a plain line can be put in its place.
 */
function detachItem(li: HTMLLIElement): { parent: Node; before: Node | null } {
  const list = li.parentNode as HTMLElement;
  const parent = list.parentNode as Node;
  const doc = li.ownerDocument;

  const tail: Element[] = [];
  for (let sibling = li.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
    tail.push(sibling);
  }
  let tailList: HTMLElement | null = null;
  if (tail.length > 0) {
    tailList = doc.createElement('ul');
    tailList.className = list.className;
    for (const item of tail) tailList.appendChild(item);
    parent.insertBefore(tailList, list.nextSibling);
  }
  li.remove();
  const before = tailList ?? list.nextSibling;
  if (list.children.length === 0) list.remove();
  return { parent, before };
}

/** Turn a row back into a plain line, keeping its content and the caret. */
function itemToLine(li: HTMLLIElement, caret: Range | null): void {
  const doc = li.ownerDocument;
  const keep =
    caret && caret.startContainer !== li
      ? { node: caret.startContainer, offset: caret.startOffset }
      : null;
  const line = doc.createElement('div');
  while (li.firstChild) line.appendChild(li.firstChild);
  fill(line);
  const { parent, before } = detachItem(li);
  parent.insertBefore(line, before);
  if (keep && line.contains(keep.node)) placeCaret(keep.node, keep.offset);
  else placeCaret(line, 0);
}

/**
 * Enter inside a checklist row. Returns true when handled (the caller then
 * prevents the browser's own Enter).
 *
 *  - In a row with text: split it at the caret; the new row is unticked.
 *  - In an EMPTY row: leave the list, as every notes app does — pressing
 *    Enter twice ends a checklist.
 */
export function checklistEnter(root: HTMLElement): boolean {
  const range = selectionIn(root);
  if (!range) return false;
  const li = checklistItemAt(root, range.startContainer);
  if (!li) return false;
  const doc = root.ownerDocument;

  if (!range.collapsed) range.deleteContents();

  if (!hasContent(li)) {
    const { parent, before } = detachItem(li);
    const line = doc.createElement('div');
    line.appendChild(doc.createElement('br'));
    parent.insertBefore(line, before);
    placeCaret(line, 0);
    return true;
  }

  const tail = doc.createRange();
  tail.setStart(range.startContainer, range.startOffset);
  tail.setEnd(li, li.childNodes.length);
  const moved = tail.extractContents();

  const next = doc.createElement('li');
  next.setAttribute('data-checked', 'false');
  if (hasContent(moved)) next.appendChild(moved);
  fill(next);
  // What stayed behind may now be empty (Enter at the very start of a row).
  if (!hasContent(li)) li.replaceChildren(doc.createElement('br'));
  li.after(next);
  placeCaret(next, 0);
  return true;
}

/**
 * Backspace at the very start of a row removes the box and keeps the text, as
 * a plain line. Anywhere else, the browser's own Backspace is right.
 */
export function checklistBackspace(root: HTMLElement): boolean {
  const range = selectionIn(root);
  if (!range || !range.collapsed) return false;
  const li = checklistItemAt(root, range.startContainer);
  if (!li) return false;
  const before = root.ownerDocument.createRange();
  before.setStart(li, 0);
  before.setEnd(range.startContainer, range.startOffset);
  if (before.toString().length > 0) return false;
  itemToLine(li, range);
  return true;
}

/** Ctrl/Cmd+Enter: tick the row the caret is in, without touching the mouse. */
export function toggleItemAtCaret(root: HTMLElement): boolean {
  const range = selectionIn(root);
  const li = range ? checklistItemAt(root, range.startContainer) : null;
  if (!li) return false;
  toggleItem(li);
  return true;
}

/** The top-level node of `root` that contains `node`. */
function topLevel(root: HTMLElement, node: Node): Node | null {
  let current: Node | null = node;
  while (current && current.parentNode !== root) current = current.parentNode;
  return current;
}

/**
 * The checklist button: make the caret's line a checklist row, or — if it
 * already is one — a plain line again. A bullet list becomes a checklist
 * whole. With no caret in the note, a new row is added at the end.
 */
export function toggleChecklistLine(root: HTMLElement): boolean {
  const doc = root.ownerDocument;
  const range = selectionIn(root);

  if (!range) {
    const list = doc.createElement('ul');
    list.className = 'cl';
    const li = doc.createElement('li');
    li.setAttribute('data-checked', 'false');
    li.appendChild(doc.createElement('br'));
    list.appendChild(li);
    root.appendChild(list);
    placeCaret(li, 0);
    return true;
  }

  const current = checklistItemAt(root, range.startContainer);
  if (current) {
    itemToLine(current, range);
    return true;
  }

  // Inside a bullet list: the whole list becomes a checklist.
  for (let node: Node | null = range.startContainer; node && node !== root; node = node.parentNode) {
    if (isElement(node) && node.tagName === 'UL' && !node.classList.contains('cl')) {
      node.classList.add('cl');
      node.querySelectorAll(':scope > li').forEach((li) => li.setAttribute('data-checked', 'false'));
      return true;
    }
  }

  const keep = { node: range.startContainer, offset: range.startOffset };

  // Which top-level nodes make up the caret's line.
  let anchor: Node | null =
    range.startContainer === root
      ? root.childNodes[range.startOffset] ?? root.childNodes[range.startOffset - 1] ?? null
      : topLevel(root, range.startContainer);

  const list = doc.createElement('ul');
  list.className = 'cl';
  const li = doc.createElement('li');
  li.setAttribute('data-checked', 'false');
  list.appendChild(li);

  if (!anchor) {
    root.appendChild(list);
  } else if (isElement(anchor) && BLOCK_TAGS.has(anchor.tagName)) {
    if (anchor.tagName === 'UL' || anchor.tagName === 'OL' || anchor.tagName === 'TABLE') {
      return false;
    }
    root.insertBefore(list, anchor);
    while (anchor.firstChild) li.appendChild(anchor.firstChild);
    anchor.remove();
  } else {
    // An inline run, bounded by <br> or a block on either side.
    const isBoundary = (node: Node | null): boolean =>
      !node || (isElement(node) && (node.tagName === 'BR' || BLOCK_TAGS.has(node.tagName)));
    if (isElement(anchor) && anchor.tagName === 'BR') {
      // Caret right before a <br>: the line is whatever precedes it.
      anchor = anchor.previousSibling && !isBoundary(anchor.previousSibling) ? anchor.previousSibling : anchor;
    }
    let first: Node = anchor;
    while (first.previousSibling && !isBoundary(first.previousSibling)) first = first.previousSibling;
    let last: Node = anchor;
    while (last.nextSibling && !isBoundary(last.nextSibling)) last = last.nextSibling;

    root.insertBefore(list, first);
    const endBr = isElement(last) && last.tagName === 'BR' ? last : last.nextSibling;
    let node: Node | null = first;
    while (node) {
      const next: Node | null = node === last ? null : node.nextSibling;
      if (!(isElement(node) && node.tagName === 'BR')) li.appendChild(node);
      else node.remove();
      node = next;
    }
    // The list is a block, so the <br> that ended this line is now redundant.
    if (endBr && isElement(endBr) && endBr.tagName === 'BR' && endBr.parentNode === root) {
      endBr.remove();
    }
  }

  fill(li);

  // One list, not a stack of one-row lists.
  const prev = list.previousSibling;
  if (isChecklist(prev)) {
    prev.appendChild(li);
    list.remove();
  }
  const host = li.parentNode as HTMLElement;
  const after = host.nextSibling;
  if (isChecklist(after)) {
    while (after.firstChild) host.appendChild(after.firstChild);
    after.remove();
  }

  if (li.contains(keep.node)) placeCaret(keep.node, keep.offset);
  else placeCaret(li, li.childNodes.length && hasContent(li) ? li.childNodes.length : 0);
  return true;
}
