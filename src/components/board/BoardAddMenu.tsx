import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Item style for anything placed in the board's "Tambah" menu, including the
 * items the canvas components portal into it (Shelf, Penanda, Gambar).
 */
export const ADD_ITEM =
  'flex min-h-tap w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm font-medium text-fg hover:bg-bg-subtle disabled:opacity-40 [@media(pointer:fine)]:min-h-9';

/**
 * Mark an element inside the menu as one that closes it when clicked.
 * Spread onto the button: `<button {...CLOSES_MENU}>`.
 */
export const CLOSES_MENU = { 'data-closes-menu': '' } as const;

/**
 * One header button for every "put something on the board" action (Avi,
 * 18 Oct 2026): Catatan, Shelf, Penanda and Gambar used to be four buttons in
 * the one-line board header and crowded search and order off the row.
 *
 * The canvas components still own their actions; they portal them into
 * `slotRef`, exactly as they used to portal them into the header. The panel
 * is therefore ALWAYS mounted and only hidden when closed: unmounting it would
 * remove the portal target and every item with it.
 *
 * Closing on an item click is a NATIVE listener, not React `onClick` on the
 * panel. React events from a portal bubble through the React tree (to
 * CanvasDrawing, CanvasStickers…), not through the DOM tree, so a React
 * handler here would never see a click on a portalled item (pattern 4).
 */
export function BoardAddMenu({
  slotRef,
  children,
}: {
  /** Receives the element the canvas components portal their items into. */
  slotRef: (element: HTMLElement | null) => void;
  /** Items owned by the page, listed after the portalled ones. */
  children?: ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return undefined;
    const onClick = (event: MouseEvent): void => {
      const target = event.target as Element | null;
      if (target?.closest('[data-closes-menu]')) setOpen(false);
    };
    panel.addEventListener('click', onClick);
    return () => panel.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((current) => !current)}
        title="Catatan, Shelf, Penanda, Gambar"
        className={`min-h-tap shrink-0 rounded-lg px-2.5 text-xs font-medium hover:bg-bg-subtle [@media(pointer:fine)]:min-h-9 ${open ? 'bg-bg-subtle text-accent' : 'text-fg'}`}
      >
        + Tambah <span aria-hidden="true">▾</span>
      </button>
      <div
        ref={panelRef}
        role="group"
        aria-label="Tambah ke papan"
        className={`${open ? 'flex' : 'hidden'} absolute right-0 top-full z-50 mt-1 max-h-[75vh] w-[300px] max-w-[calc(100vw-2rem)] flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface p-1 shadow-lg`}
      >
        {children}
        <div ref={slotRef} className="contents" />
      </div>
    </span>
  );
}
