import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useBackToClose } from '@/lib/useBackToClose';

/**
 * The full note, floating above the board next to its card.
 *
 * Portalled to `body` with fixed coordinates from the strip's rectangle, so
 * no scroll container or `overflow-hidden` cell can clip it, and repositioned
 * on scroll and resize. Opens below the strip, or above it when there is more
 * room there; its height is capped by the room available and it scrolls.
 */
export function NotePopover({
  anchor,
  title,
  note,
  onClose,
}: {
  anchor: RefObject<HTMLElement>;
  title: string;
  note: string;
  onClose: () => void;
}): JSX.Element | null {
  useBackToClose(true, onClose);
  const panelRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    const place = (): void => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 8;
      const width = Math.min(Math.max(rect.width, 280), 440, window.innerWidth - margin * 2);
      const left = Math.min(Math.max(rect.left, margin), window.innerWidth - width - margin);
      const below = window.innerHeight - rect.bottom - margin;
      const above = rect.top - margin;
      if (below >= 200 || below >= above) {
        setBox({ left, width, top: rect.bottom + 4, maxHeight: Math.max(120, below - 4) });
      } else {
        setBox({ left, width, bottom: window.innerHeight - rect.top + 4, maxHeight: Math.max(120, above - 4) });
      }
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [anchor]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    const onDown = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchor.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    panelRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [anchor, onClose]);

  if (!box) return null;
  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`Catatan ${title}`}
      tabIndex={-1}
      style={{
        position: 'fixed',
        left: box.left,
        width: box.width,
        top: box.top,
        bottom: box.bottom,
        maxHeight: box.maxHeight,
      }}
      className="z-50 flex flex-col overflow-hidden rounded-xl border border-[var(--warn-strong)] bg-surface text-fg shadow-2xl outline-none"
    >
      <div className="flex items-center gap-2 border-b border-border bg-[var(--warn-soft)] px-3 py-1.5">
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">Catatan · {title}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup catatan"
          className="-my-1 min-h-tap min-w-tap rounded-lg text-fg-muted [@media(pointer:fine)]:min-h-8 [@media(pointer:fine)]:min-w-8"
        >
          ×
        </button>
      </div>
      <p className="overflow-y-auto whitespace-pre-line break-words px-3 py-2 text-[13px] leading-relaxed [overflow-wrap:anywhere]">
        {note}
      </p>
    </div>,
    document.body,
  );
}
