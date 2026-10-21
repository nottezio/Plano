import type { Command, EditorState, Transaction } from '@tiptap/pm/state';
import { TextSelection } from '@tiptap/pm/state';
import { Fragment } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

import { CHECK_ZONE_PX } from './schema';

/**
 * Editor commands for Catatan (added 18 Oct 2026). Plain ProseMirror commands,
 * so they are tested on an EditorState without React.
 */

/** Flip `checked` of the checklistItem starting at `pos`. */
export function toggleChecklistAt(pos: number): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    if (!node || node.type.name !== 'checklistItem') return false;
    if (dispatch) {
      dispatch(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: !node.attrs['checked'] }));
    }
    return true;
  };
}

/** Start of the innermost checklistItem around the selection, or -1. */
function checklistItemAtCaret(state: EditorState): number {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'checklistItem') return $from.before(depth);
  }
  return -1;
}

export const toggleChecklistAtCaret: Command = (state, dispatch) => {
  const pos = checklistItemAtCaret(state);
  return pos >= 0 ? toggleChecklistAt(pos)(state, dispatch) : false;
};

/**
 * A press in the drawn box of a checklist row ticks it.
 *
 * On POINTERDOWN, prevented, so the tap neither moves the caret nor raises a
 * phone keyboard just to tick a row (the old editor's rule, kept). Only when
 * the editor is editable: a note in Sampah is read-only and must not change.
 */
export function handleTickPointer(view: EditorView, event: PointerEvent | MouseEvent): boolean {
  if (!view.editable) return false;
  const li = (event.target as Element | null)?.closest?.('ul.cl > li');
  if (!li || !view.dom.contains(li)) return false;
  // The row's own box only: a nested row's box belongs to the nested row.
  const left = li.getBoundingClientRect().left;
  if (event.clientX - left > CHECK_ZONE_PX) return false;
  const pos = view.posAtDOM(li, 0) - 1;
  const node: PMNode | null = view.state.doc.nodeAt(pos);
  if (!node || node.type.name !== 'checklistItem') return false;
  event.preventDefault();
  toggleChecklistAt(pos)(view.state, (tr: Transaction) => view.dispatch(tr));
  return true;
}

export function tickPlugin(): Plugin {
  return new Plugin({
    key: new PluginKey('catatanTick'),
    props: {
      handleDOMEvents: {
        pointerdown: (view, event) => handleTickPointer(view, event),
        // Must be non-passive and prevented, or the tap still raises the keyboard.
        touchstart: (view, event) => {
          const touch = event.touches[0];
          const li = (event.target as Element | null)?.closest?.('ul.cl > li');
          if (!view.editable || !touch || !li) return false;
          if (touch.clientX - li.getBoundingClientRect().left > CHECK_ZONE_PX) return false;
          event.preventDefault();
          return true;
        },
      },
    },
  });
}

const ITEM_TYPES = new Set(['listItem', 'checklistItem']);

/**
 * Move the innermost list item around the caret (else its top-level block)
 * past one sibling, with everything nested in it. False at either end, so
 * `editor.can()` disables the ↑/↓ buttons there.
 */
export function moveBlock(dir: 'up' | 'down'): Command {
  return (state, dispatch) => {
    const { $from } = state.selection;
    let depth = 1;
    for (let d = $from.depth; d > 0; d -= 1) {
      if (ITEM_TYPES.has($from.node(d).type.name)) {
        depth = d;
        break;
      }
    }
    if ($from.depth < depth) return false;
    const node = $from.node(depth);
    const parent = $from.node(depth - 1);
    const index = $from.index(depth - 1);
    const sibling = dir === 'up' ? index - 1 : index + 1;
    if (sibling < 0 || sibling >= parent.childCount) return false;
    if (!dispatch) return true;
    const other = parent.child(sibling);
    const start = $from.before(depth);
    const end = $from.after(depth);
    const shift = dir === 'up' ? -other.nodeSize : other.nodeSize;
    const tr = state.tr.delete(start, end).insert(start + (dir === 'up' ? shift : other.nodeSize), node);
    const caret = state.selection.from + shift;
    tr.setSelection(TextSelection.create(tr.doc, caret));
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/** Rebuild `node` with every checklist's ticked items after its unticked ones. */
function sinkIn(node: PMNode): PMNode {
  if (node.isLeaf || node.childCount === 0) return node;
  const children: PMNode[] = [];
  node.forEach((child) => children.push(sinkIn(child)));
  const ordered =
    node.type.name === 'checklist'
      ? [...children.filter((c) => !c.attrs['checked']), ...children.filter((c) => c.attrs['checked'])]
      : children;
  return node.copy(Fragment.fromArray(ordered));
}

/** "Pindahkan yang selesai ke bawah": one-shot, per checklist and per level. */
export const sinkDone: Command = (state, dispatch) => {
  const next = sinkIn(state.doc);
  if (next.eq(state.doc)) return false;
  if (dispatch) dispatch(state.tr.replaceWith(0, state.doc.content.size, next.content));
  return true;
};

/**
 * The line at the caret becomes a toggle's title, with an empty body under
 * it, caret at the end of the title — Notion's toggle (22 Oct 2026). TipTap's
 * own `setDetails` puts the line in the BODY under an empty title.
 */
export function lineToToggle(editor: import('@tiptap/core').Editor): boolean {
  const { $from } = editor.state.selection;
  if ($from.depth < 1 || !$from.parent.isTextblock) return false;
  const text = $from.parent.textContent;
  const from = $from.before();
  return editor
    .chain()
    .focus()
    .insertContentAt(
      { from, to: $from.after() },
      {
        type: 'details',
        // Open, so the body under the title can be typed into at once.
        attrs: { open: true },
        content: [
          { type: 'detailsSummary', ...(text ? { content: [{ type: 'text', text }] } : {}) },
          { type: 'detailsContent', content: [{ type: 'paragraph' }] },
        ],
      },
    )
    .setTextSelection(from + 2 + text.length)
    .run();
}
