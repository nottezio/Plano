import { useEffect, useState, type RefObject } from 'react';

/**
 * Hide a pinned header while scrolling DOWN, show it on any scroll UP — the
 * address-bar pattern. On a phone the pinned board header costs two rows of
 * a small screen; this gives them back while reading cards, and returns them
 * with one flick up.
 *
 * `JITTER` ignores the few pixels a finger drifts while holding still, and
 * the header is always shown within its own height of the top, so it can
 * never be hidden with nothing scrolled under it.
 */
const JITTER = 6;

export function nextHidden(
  hidden: boolean,
  y: number,
  lastY: number,
  headerHeight: number,
): boolean {
  if (y <= headerHeight) return false;
  const delta = y - lastY;
  if (delta > JITTER) return true;
  if (delta < -JITTER) return false;
  return hidden;
}

export function useHideOnScroll(ref: RefObject<HTMLElement>, enabled: boolean): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      return;
    }
    const header = ref.current;
    const scroller = header?.closest('main');
    if (!header || !scroller) return;

    let lastY = scroller.scrollTop;
    let frame = 0;
    const onScroll = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = scroller.scrollTop;
        const previous = lastY;
        const height = header.offsetHeight;
        /*
          `previous`, captured NOW. The updater runs whenever React gets to
          it, and by then `lastY` below has already moved on to `y`, so it
          saw no movement and never un-hid the header. The first hide only
          worked because React happened to compute that update eagerly.
        */
        setHidden((current) => nextHidden(current, y, previous, height));
        if (Math.abs(y - previous) > JITTER || y <= height) lastY = y;
      });
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', onScroll);
    };
  }, [ref, enabled]);

  return hidden;
}
