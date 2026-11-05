import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const OPEN_DELAY_MS = 350;
/** Long enough to cross the rest of the card on the way to the panel. */
const CLOSE_DELAY_MS = 250;
const PANEL_WIDTH = 340;
const MARGIN = 8;

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Beside the card, so its neighbours stay readable; below or above the text when a row fills the width. */
export function placeHoverPanel(
  card: Rect,
  zone: Rect,
  panelHeight: number,
  viewport: { width: number; height: number },
): { left: number; top: number; width: number } {
  const width = Math.min(PANEL_WIDTH, viewport.width - MARGIN * 2);
  const clampTop = (top: number): number => Math.max(MARGIN, Math.min(top, viewport.height - panelHeight - MARGIN));
  if (viewport.width - card.right >= width + MARGIN * 2) {
    return { left: card.right + MARGIN, top: clampTop(zone.top), width };
  }
  if (card.left >= width + MARGIN * 2) {
    return { left: card.left - width - MARGIN, top: clampTop(zone.top), width };
  }
  const left = Math.max(MARGIN, Math.min(zone.left, viewport.width - width - MARGIN));
  const fitsBelow = zone.bottom + MARGIN + panelHeight <= viewport.height;
  return { left, top: clampTop(fitsBelow ? zone.bottom + MARGIN : zone.top - MARGIN - panelHeight), width };
}

/**
 * The whole text of a card's diagnosis or Catatan, on mouse hover.
 *
 * The card's stretched link lies over this text so that a click anywhere opens
 * the patient, so the pointer is tested against this box's rectangle instead of
 * hover events on it. Mouse only: a touch screen has the Dx button and the note.
 */
export function HoverDetail({
  title,
  text,
  disabled = false,
  children,
}: {
  title: string;
  /** Empty means there is nothing more to show than the card already does. */
  text: string;
  disabled?: boolean;
  children: ReactNode;
}): JSX.Element {
  const zoneRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const wanted = useRef(false);
  const dismissed = useRef(false);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ left: number; top: number; width: number } | null>(null);
  const active = !disabled && text !== '';

  const want = useCallback((next: boolean): void => {
    if (wanted.current === next) return;
    wanted.current = next;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(next), next ? OPEN_DELAY_MS : CLOSE_DELAY_MS);
  }, []);

  const dismiss = useCallback((): void => {
    window.clearTimeout(timer.current);
    wanted.current = false;
    dismissed.current = true;
    setOpen(false);
  }, []);

  useEffect(() => {
    const zone = zoneRef.current;
    const card = zone?.closest('[data-patient-card],[data-patient-row]');
    if (!active || !zone || !card) return undefined;
    const onMove = (event: Event): void => {
      const { pointerType, clientX, clientY, buttons } = event as PointerEvent;
      if (pointerType !== 'mouse') return;
      const rect = zone.getBoundingClientRect();
      const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
      if (!inside) dismissed.current = false;
      // A drag is moving the card, not reading it.
      want(inside && !dismissed.current && buttons === 0);
    };
    const onLeave = (): void => {
      dismissed.current = false;
      want(false);
    };
    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerleave', onLeave);
    return () => {
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerleave', onLeave);
      window.clearTimeout(timer.current);
      wanted.current = false;
      setOpen(false);
    };
  }, [active, want]);

  useLayoutEffect(() => {
    const zone = zoneRef.current?.getBoundingClientRect();
    const card = zoneRef.current?.closest('[data-patient-card],[data-patient-row]')?.getBoundingClientRect();
    const panel = panelRef.current;
    if (!open || !zone || !card || !panel) {
      setBox(null);
      return;
    }
    setBox(placeHoverPanel(card, zone, panel.offsetHeight, { width: window.innerWidth, height: window.innerHeight }));
  }, [open, text]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') dismiss();
    };
    const closeUnlessInPanel = (event: Event): void => {
      if (!panelRef.current?.contains(event.target as Node)) dismiss();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', closeUnlessInPanel, true);
    window.addEventListener('scroll', closeUnlessInPanel, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', closeUnlessInPanel, true);
      window.removeEventListener('scroll', closeUnlessInPanel, true);
    };
  }, [open, dismiss]);

  return (
    <div ref={zoneRef} className="min-w-0">
      {children}
      {open && active
        ? createPortal(
            <div
              ref={panelRef}
              role="tooltip"
              onPointerEnter={() => want(true)}
              onPointerLeave={() => want(false)}
              // A portal still bubbles through the card in React: these would drag it or open its checklist.
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.stopPropagation()}
              style={{ position: 'fixed', left: box?.left ?? 0, top: box?.top ?? 0, width: box?.width ?? PANEL_WIDTH, visibility: box ? 'visible' : 'hidden' }}
              className="z-50 max-h-[60dvh] overflow-y-auto rounded-xl border border-border-strong bg-surface px-3 py-2 text-fg shadow-pop"
            >
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">{title}</p>
              <p className="whitespace-pre-wrap text-[13px] leading-snug [overflow-wrap:anywhere]">{text}</p>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
