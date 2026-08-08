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

export function ScrollToTop(): JSX.Element | null {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // The app's scroll container is <main>, not the window: the shell is a
    // fixed-height flex layout, so window.scrollY never moves.
    const scroller = document.querySelector('main');
    if (!scroller) return;

    const onScroll = (): void => setVisible(scroller.scrollTop > SHOW_AFTER_PX);
    onScroll();

    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Kembali ke atas"
      onClick={() => {
        const scroller = document.querySelector('main');
        scroller?.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+80px)] right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-lg shadow-lg sm:bottom-6"
    >
      <span aria-hidden="true">↑</span>
    </button>
  );
}
