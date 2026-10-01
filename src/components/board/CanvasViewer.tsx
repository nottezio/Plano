import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  MIN_CARD_PX,
  ROW_STEP,
  columnsFor,
  placeAll,
  type CanvasLayouts,
} from '@/domain/board/canvasLayout';

/**
 * The laptop's canvas, on the phone: same arrangement, scaled to fit, read
 * only (2026-10-01).
 *
 * The phone is too narrow to arrange a canvas, so it does not get an editor.
 * It draws the layout the account carries (`SharedCanvas`) at the width it was
 * arranged at, then scales the whole surface down. Every card sits exactly
 * where it sits on the laptop; pinch or the − / + buttons zoom in to read it,
 * and a tap opens the patient as anywhere else.
 *
 * Patients with no position yet (admitted since the laptop last arranged) are
 * auto-placed the same way the laptop would place them, so nobody is missing.
 */
export function CanvasViewer({
  ids,
  layouts,
  width,
  renderItem,
}: {
  ids: readonly string[];
  layouts: CanvasLayouts;
  /** The canvas width the layout was arranged at, px. */
  width: number;
  renderItem: (id: string, options: { fitHeight: boolean; maxPreviewLines: number }) => ReactNode;
}): JSX.Element {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);

  const placed = useMemo(() => placeAll(ids, layouts, columnsFor(width)), [ids, layouts, width]);

  useLayoutEffect(() => {
    const node = outerRef.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(() => setViewport(node.clientWidth));
    observer.observe(node);
    setViewport(node.clientWidth);
    return () => observer.disconnect();
  }, []);

  // The surface's real height, from the cards as rendered (heights are not
  // stored unless capped).
  useEffect(() => {
    const node = innerRef.current;
    if (!node) return undefined;
    const measure = (): void => {
      let bottom = 0;
      for (const child of Array.from(node.children)) {
        const element = child as HTMLElement;
        bottom = Math.max(bottom, element.offsetTop + element.offsetHeight);
      }
      setContentHeight(bottom + 24);
    };
    const observer = new ResizeObserver(measure);
    for (const child of Array.from(node.children)) observer.observe(child);
    measure();
    return () => observer.disconnect();
  }, [placed]);

  const fit = viewport > 0 ? viewport / width : 0.3;
  const scale = zoom ?? fit;
  const clampZoom = (value: number): number => Math.min(1.25, Math.max(fit, value));

  /*
    Pinch to zoom. Two pointers on the surface; the scale follows the ratio
    of their distance, anchored at the midpoint so what is between the
    fingers stays between them. One finger is left to the browser's own
    scrolling.
  */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  const onPointerDown = (event: React.PointerEvent): void => {
    if (event.pointerType !== 'touch') return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a!.x - b!.x, a!.y - b!.y), scale };
    }
  };
  const onPointerMove = (event: React.PointerEvent): void => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const start = pinch.current;
    const outer = outerRef.current;
    if (!start || pointers.current.size !== 2 || !outer) return;
    const [a, b] = [...pointers.current.values()];
    const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
    const next = clampZoom(start.scale * (distance / start.distance));
    // Keep the midpoint fixed on screen.
    const rect = outer.getBoundingClientRect();
    const midX = (a!.x + b!.x) / 2 - rect.left;
    const midY = (a!.y + b!.y) / 2 - rect.top;
    const contentX = (outer.scrollLeft + midX) / scale;
    const contentY = (outer.scrollTop + midY) / scale;
    setZoom(next);
    requestAnimationFrame(() => {
      outer.scrollLeft = contentX * next - midX;
      outer.scrollTop = contentY * next - midY;
    });
  };
  const onPointerEnd = (event: React.PointerEvent): void => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const height = Math.max(contentHeight, ROW_STEP);

  return (
    <div className="px-4 pb-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-fg-muted">
        <span className="min-w-0 flex-1">Kanvas dari laptop · cubit untuk memperbesar</span>
        <button
          type="button"
          aria-label="Perkecil"
          onClick={() => setZoom(clampZoom(scale / 1.4))}
          className="min-h-tap min-w-tap rounded-lg border border-border bg-surface text-base"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setZoom(null)}
          className="min-h-tap rounded-lg border border-border bg-surface px-3"
        >
          Pas layar
        </button>
        <button
          type="button"
          aria-label="Perbesar"
          onClick={() => setZoom(clampZoom(scale * 1.4))}
          className="min-h-tap min-w-tap rounded-lg border border-border bg-surface text-base"
        >
          +
        </button>
      </div>
      <div
        ref={outerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className="overflow-auto rounded-xl border border-border bg-bg-subtle"
        style={{ touchAction: 'pan-x pan-y', maxHeight: '75dvh' }}
      >
        <div style={{ width: width * scale, height: height * scale }}>
          <div
            ref={innerRef}
            className="relative origin-top-left"
            style={{ width, height, transform: `scale(${scale})` }}
          >
            {ids.map((id) => {
              const layout = placed[id];
              if (!layout) return null;
              const capped = layout.hMax > 0;
              return (
                <div
                  key={id}
                  className={capped ? 'absolute flex flex-col overflow-hidden' : 'absolute'}
                  style={{
                    left: layout.x * width,
                    top: layout.y,
                    width: Math.max(MIN_CARD_PX, layout.w * width),
                    ...(capped ? { height: layout.hMax } : {}),
                  }}
                >
                  {renderItem(id, { fitHeight: capped, maxPreviewLines: 60 })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
