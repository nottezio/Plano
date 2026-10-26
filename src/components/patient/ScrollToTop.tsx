import { useEffect, useState } from 'react';

/**
 * A note that carries the greeting, identity, three days of EKG and a full plan
 * is several screens long, and the controls that matter — Pembuka, Salin,
 * identity — all live in the header. Without this, getting back to them means
 * flicking through the whole note.
 *
 * Appears only once there is somewhere to scroll back to, so it never covers
 * text on a short note.
 */
const SHOW_AFTER_PX = 400;

/** Clear of the working area's own scrollbar and its edge. */
const EDGE_GAP_PX = 20;

export function ScrollToTop(): JSX.Element | null {
  const [visible, setVisible] = useState(false);
  /**
   * Distance from the window's right edge: the button sits inside the scroller
   * (<main>), past its scrollbar, not at the window's edge. On a wide screen
   * the window edge is the side panel's scrollbar, and a button fixed there
   * covered the scrollbar and the panel's cards (28 Oct 2026, Avi: "placed
   * weirdly").
   */
  const [right, setRight] = useState(EDGE_GAP_PX);

  useEffect(() => {
    // The app's scroll container is <main>, not the window: the shell is a
    // fixed-height flex layout, so window.scrollY never moves.
    const scroller = document.querySelector('main');
    if (!scroller) return;

    const onScroll = (): void => setVisible(scroller.scrollTop > SHOW_AFTER_PX);
    const place = (): void => {
      const rect = scroller.getBoundingClientRect();
      const scrollbar = scroller.offsetWidth - scroller.clientWidth;
      setRight(Math.max(EDGE_GAP_PX, window.innerWidth - rect.right + scrollbar + EDGE_GAP_PX));
    };
    onScroll();
    place();

    scroller.addEventListener('scroll', onScroll, { passive: true });
    const observer = new ResizeObserver(place);
    observer.observe(scroller);
    window.addEventListener('resize', place);
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      observer.disconnect();
      window.removeEventListener('resize', place);
    };
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Kembali ke atas"
      title="Kembali ke atas"
      onClick={() => {
        const scroller = document.querySelector('main');
        scroller?.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      style={{ right }}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+80px)] z-30 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-fg-muted shadow-pop transition-colors hover:border-border-strong hover:text-fg sm:bottom-6"
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 13V3m0 0L3.5 7.5M8 3l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
