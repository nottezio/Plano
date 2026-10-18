import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';

/**
 * The ⠿ handle beside the block under the mouse (desktop only; added 18 Oct
 * 2026). Dragging it moves that block — the innermost list item, with its
 * nested items, or a top-level block — using ProseMirror's own block drag:
 * the handle selects the node and hands ProseMirror the slice as
 * `view.dragging`, and ProseMirror's drop handling does the move.
 *
 * Our own rather than @tiptap/extension-drag-handle, which imports the
 * real-time collaboration packages (yjs) Catatan has no use for.
 */
const ITEMS = new Set(['listItem', 'checklistItem']);

interface Target {
  pos: number;
  top: number;
}

export function BlockHandle({ editor, frame }: { editor: Editor; frame: RefObject<HTMLElement> }): JSX.Element | null {
  const [target, setTarget] = useState<Target | null>(null);
  const targetRef = useRef<Target | null>(null);
  targetRef.current = target;

  useEffect(() => {
    const dom = editor.view.dom;
    const onMove = (event: MouseEvent): void => {
      const box = frame.current;
      if (!box || !editor.isEditable) return;
      const hit = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
      if (!hit) return;
      const $pos = editor.state.doc.resolve(hit.pos);
      if ($pos.depth < 1) return;
      let depth = 1;
      for (let d = $pos.depth; d > 0; d -= 1) {
        if (ITEMS.has($pos.node(d).type.name)) {
          depth = d;
          break;
        }
      }
      const pos = $pos.before(depth);
      const node = editor.view.nodeDOM(pos);
      if (!(node instanceof HTMLElement)) return;
      const top = node.getBoundingClientRect().top - box.getBoundingClientRect().top;
      if (targetRef.current?.pos !== pos || targetRef.current.top !== top) setTarget({ pos, top });
    };
    const onLeave = (event: MouseEvent): void => {
      const to = event.relatedTarget as Node | null;
      if (to && frame.current?.contains(to)) return;
      setTarget(null);
    };
    dom.addEventListener('mousemove', onMove);
    frame.current?.addEventListener('mouseleave', onLeave);
    const box = frame.current;
    return () => {
      dom.removeEventListener('mousemove', onMove);
      box?.removeEventListener('mouseleave', onLeave);
    };
  }, [editor, frame]);

  if (!target) return null;

  return (
    <div
      draggable
      aria-hidden="true"
      title="Seret untuk memindahkan"
      onDragStart={(event) => {
        const { view } = editor;
        const selection = NodeSelection.create(view.state.doc, target.pos);
        view.dispatch(view.state.tr.setSelection(selection));
        view.dragging = { slice: selection.content(), move: true };
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', selection.content().content.textBetween(0, selection.content().content.size, '\n'));
        const dom = view.nodeDOM(target.pos);
        if (dom instanceof HTMLElement) event.dataTransfer.setDragImage(dom, 0, 0);
      }}
      onDragEnd={() => setTarget(null)}
      style={{ top: target.top }}
      className="absolute left-0 flex h-7 w-6 cursor-grab select-none items-center justify-center rounded text-fg-faint hover:bg-bg-subtle hover:text-fg-muted active:cursor-grabbing"
    >
      ⠿
    </div>
  );
}
