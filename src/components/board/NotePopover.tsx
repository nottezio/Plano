import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useBackToClose } from '@/lib/useBackToClose';

/** The amber of a note: opaque, so a coloured card behind it cannot tint it. */
export const NOTE_FILL = 'bg-[color-mix(in_srgb,var(--warn-strong)_22%,var(--surface))]';

/**
 * The full note, floating above the board next to its card.
 *
 * Portalled to `body` with fixed coordinates from the strip's rectangle, so
 * no scroll container or `overflow-hidden` cell can clip it, and repositioned
 * on scroll and resize. Opens below the strip, or above it when there is more
 * room there; its height is capped by the room available and it scrolls.
 *
 * `unfold` is for a card's note strip: the panel opens ON the strip, same left
 * edge and width, same fill and glyph, so it reads as the strip growing rather
 * than a second box beside it. The strip's text is the panel's first lines, so
 * there is no title bar repeating the patient's name from the card above.
 */
export function NotePopover({
  anchor,
  title,
  note,
  onClose,
  unfold = false,
}: {
  anchor: RefObject<HTMLElement>;
  title: string;
  note: string;
  onClose: () => void;
  unfold?: boolean;
}): JSX.Element | null {
  useBackToClose(true, onClose);
  const panelRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    const place = (): void => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 8;
      if (unfold) {
        const width = Math.min(Math.max(rect.width, 280), window.innerWidth - margin * 2);
        const left = Math.min(Math.max(rect.left, margin), window.innerWidth - width - margin);
        const below = window.innerHeight - rect.top - margin;
        const above = rect.bottom - margin;
        if (below >= 200 || below >= above) {
          setBox({ left, width, top: rect.top, maxHeight: Math.max(120, below) });
        } else {
          setBox({ left, width, bottom: window.innerHeight - rect.bottom, maxHeight: Math.max(120, above) });
        }
        return;
      }
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
  }, [anchor, unfold]);

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
  const style = {
    position: 'fixed',
    left: box.left,
    width: box.width,
    top: box.top,
    bottom: box.bottom,
    maxHeight: box.maxHeight,
  } as const;
  const closeButton = (
    <button
      type="button"
      onClick={onClose}
      aria-label="Tutup catatan"
      className="-my-1 min-h-tap min-w-tap rounded-lg text-fg-muted [@media(pointer:fine)]:min-h-8 [@media(pointer:fine)]:min-w-8"
    >
      ×
    </button>
  );

  if (unfold) {
    // Growing downward it continues the card's squared bottom, so the top edge
    // is the strip's own (no border, square). Growing upward there is no seam
    // to keep, so it is an ordinary rounded panel.
    const down = box.top !== undefined;
    return createPortal(
      <div
        ref={panelRef}
        role="dialog"
        aria-label={`Catatan ${title}`}
        tabIndex={-1}
        style={style}
        className={[
          'z-50 flex items-start gap-1.5 overflow-hidden border border-[var(--warn-strong)] px-2.5 py-1.5 text-fg shadow-pop outline-none',
          NOTE_FILL,
          down ? 'rounded-b-xl rounded-t-none border-t-0' : 'rounded-xl',
        ].join(' ')}
      >
        <span aria-hidden="true" className="mt-px shrink-0 text-[11px] leading-snug text-[var(--warn-strong)]">
          ✎
        </span>
        <p className="min-w-0 flex-1 self-stretch overflow-y-auto whitespace-pre-line break-words text-xs leading-snug [overflow-wrap:anywhere]">
          {note}
        </p>
        <div className="-mr-1.5 shrink-0">{closeButton}</div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`Catatan ${title}`}
      tabIndex={-1}
      style={style}
      className="z-50 flex flex-col overflow-hidden rounded-xl border border-[var(--warn-strong)] bg-surface text-fg shadow-sheet outline-none"
    >
      <div className="flex items-center gap-2 border-b border-border bg-[var(--warn-soft)] px-3 py-1.5">
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">Catatan · {title}</span>
        {closeButton}
      </div>
      <p className="overflow-y-auto whitespace-pre-line break-words px-3 py-2 text-[13px] leading-relaxed [overflow-wrap:anywhere]">
        {note}
      </p>
    </div>,
    document.body,
  );
}
