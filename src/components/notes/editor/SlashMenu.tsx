import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { ReactRenderer } from '@tiptap/react';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { exitSuggestion } from '@tiptap/suggestion';


import { SLASH_PLUGIN_KEY, type SlashItem, type SlashRender } from './slash';

/**
 * The `/` menu (added 18 Oct 2026): a list at the caret. Up/Down + Enter, or
 * a tap; Esc closes it and leaves what was typed.
 */
interface SlashMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

type SlashMenuProps = SuggestionProps<SlashItem>;

const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(function SlashMenu({ items, command }, ref) {
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (items.length === 0) return false;
      if (event.key === 'ArrowDown') {
        setActive((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowUp') {
        setActive((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        const item = items[active];
        if (item) command(item);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return <p className="px-3 py-2 text-xs text-fg-muted">Tidak ada pilihan</p>;
  }
  return (
    <div role="listbox" aria-label="Pilih blok" className="flex flex-col">
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={index === active}
          // Keep the editor's selection: the press must not take focus.
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => setActive(index)}
          onClick={() => command(item)}
          className={[
            'flex min-h-tap items-center rounded-lg px-3 text-left text-sm',
            index === active ? 'bg-bg-subtle text-fg' : 'text-fg-muted',
          ].join(' ')}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
});

/** Place the popup under the caret, inside the viewport. */
function place(element: HTMLElement, rect: DOMRect | null | undefined): void {
  if (!rect) return;
  // The editor's own window: the note may be open in the mini window (22 Oct 2026).
  const view = element.ownerDocument.defaultView ?? window;
  const width = Math.min(240, view.innerWidth - 16);
  element.style.width = `${width}px`;
  element.style.left = `${Math.max(8, Math.min(rect.left, view.innerWidth - width - 8))}px`;
  const below = rect.bottom + 6;
  const room = view.innerHeight - below;
  element.style.top = room > 200 ? `${below}px` : `${Math.max(8, rect.top - 6 - Math.min(320, element.offsetHeight || 320))}px`;
}


export const slashRender: SlashRender = () => {
  let renderer: ReactRenderer<SlashMenuHandle, SlashMenuProps> | null = null;
  let host: HTMLDivElement | null = null;

  return {
    onStart: (props) => {
      const doc = props.editor.view.dom.ownerDocument;
      host = doc.createElement('div');
      host.className =
        'fixed z-[70] max-h-80 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-pop';
      doc.body.appendChild(host);
      renderer = new ReactRenderer(SlashMenu, { props, editor: props.editor });
      host.appendChild(renderer.element);
      place(host, props.clientRect?.());
    },
    onUpdate: (props) => {
      renderer?.updateProps(props);
      if (host) place(host, props.clientRect?.());
    },
    onKeyDown: (props: SuggestionKeyDownProps) => {
      if (props.event.key === 'Escape') {
        exitSuggestion(props.view, SLASH_PLUGIN_KEY);
        return true;
      }
      return renderer?.ref?.onKeyDown(props.event) ?? false;
    },
    onExit: () => {
      renderer?.destroy();
      host?.remove();
      renderer = null;
      host = null;
    },
  };
};
