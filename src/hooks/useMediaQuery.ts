import { useEffect, useState } from 'react';

/**
 * Track a CSS media query from JS.
 *
 * Needed only where a breakpoint changes WHICH COMPONENT renders, not how one
 * looks. Anything expressible as a Tailwind `lg:` class stays a class — a
 * second source of truth for the same breakpoint is how the two drift and the
 * layout ends up correct at neither size.
 *
 * The initial read happens in the state initialiser rather than in an effect,
 * so the first paint is already right. Reading it after mount renders the
 * wrong branch once and then swaps it, which on this board means the whole set
 * of cards mounting twice.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = (): void => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
