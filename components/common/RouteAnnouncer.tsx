import { useEffect, useRef } from 'react';

/**
 * SPEC 20 — screen-reader route announcements.
 *
 * A single-page app changes the whole screen without a page load, so assistive
 * technology gets no signal that anything happened. This polite live region
 * announces the new page title on every navigation.
 *
 * The first render is skipped deliberately: announcing the landing page over
 * the top of the app's own initial focus is noise, not information.
 */
export function RouteAnnouncer({ title }: { title: string }): JSX.Element {
  const first = useRef(true);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (ref.current) ref.current.textContent = title;
  }, [title]);

  return <p ref={ref} aria-live="polite" aria-atomic="true" className="sr-only" />;
}
