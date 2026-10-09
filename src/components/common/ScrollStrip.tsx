import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * A row that scrolls sideways — and can be scrolled with ANY input.
 *
 * ROOT CAUSE (Avi, 2026-10-09: "when it overflows you can't choose the
 * overflowed text"). The jump bar, the Helper tabs and the Tersimpan chips
 * were `overflow-x-auto` with the scrollbar hidden. A finger swipes such a
 * row; a mouse cannot: the wheel scrolls vertically, the scrollbar that
 * would be dragged is hidden, and nothing on screen says there is more. On
 * the PC the sections past the right edge were simply unreachable.
 *
 * So every hidden-scrollbar row goes through here:
 *   - the vertical wheel scrolls the row sideways while it can move, then
 *     lets the page have the wheel back at either end;
 *   - the side with hidden content fades out, on every device;
 *   - on a mouse/trackpad, a ‹ / › button sits on that side and pages it.
 */

/** Which ends have hidden content. 1 px of slack for fractional layout. */
export function stripEdges(scrollLeft: number, clientWidth: number, scrollWidth: number): {
  left: boolean;
  right: boolean;
} {
  return {
    left: scrollLeft > 1,
    right: scrollLeft + clientWidth < scrollWidth - 1,
  };
}

/**
 * How far a wheel event should move the row, or 0 to leave it to the page.
 * Only a mostly-vertical wheel is converted (a trackpad's own sideways swipe
 * already scrolls the row), and only while the row can still move that way.
 */
export function wheelShift(
  deltaX: number,
  deltaY: number,
  edges: { left: boolean; right: boolean },
): number {
  if (Math.abs(deltaY) <= Math.abs(deltaX)) return 0;
  if (deltaY > 0 && !edges.right) return 0;
  if (deltaY < 0 && !edges.left) return 0;
  return deltaY;
}

export function ScrollStrip({
  children,
  className = '',
  outerClassName = '',
  fade = 'from-bg',
  label,
  role,
}: {
  children: ReactNode;
  /** Classes for the scrolling row itself (flex, gap, padding, border). */
  className?: string;
  outerClassName?: string;
  /** Tailwind `from-*` matching the background the row sits on. */
  fade?: string;
  label?: string;
  role?: string;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    const next = stripEdges(node.scrollLeft, node.clientWidth, node.scrollWidth);
    setEdges((current) => (current.left === next.left && current.right === next.right ? current : next));
  }, []);

  // Children change width without a resize (a section added to the note).
  useLayoutEffect(measure);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onWheel = (event: WheelEvent): void => {
      const now = stripEdges(node.scrollLeft, node.clientWidth, node.scrollWidth);
      const shift = wheelShift(event.deltaX, event.deltaY, now);
      if (!shift) return;
      event.preventDefault();
      node.scrollLeft += shift;
    };
    // Not passive: preventDefault is what keeps the page from also scrolling.
    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(node);
    return () => {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [measure]);

  const page = (direction: 1 | -1): void => {
    const node = ref.current;
    if (!node) return;
    node.scrollBy({ left: direction * Math.max(80, node.clientWidth * 0.7), behavior: 'smooth' });
  };

  const arrow =
    'absolute inset-y-0 z-10 hidden w-8 items-center justify-center text-lg font-semibold leading-none text-fg-muted hover:text-fg [@media(pointer:fine)]:flex';

  return (
    <div className={`relative min-w-0 ${outerClassName}`}>
      <div
        ref={ref}
        {...(role ? { role } : {})}
        {...(label ? { 'aria-label': label } : {})}
        className={`overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      >
        {children}
      </div>
      {edges.left ? (
        <>
          <span aria-hidden="true" className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r ${fade} to-transparent`} />
          <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => page(-1)} className={`${arrow} left-0`}>
            ‹
          </button>
        </>
      ) : null}
      {edges.right ? (
        <>
          <span aria-hidden="true" className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l ${fade} to-transparent`} />
          <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => page(1)} className={`${arrow} right-0`}>
            ›
          </button>
        </>
      ) : null}
    </div>
  );
}
