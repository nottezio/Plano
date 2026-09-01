/**
 * Resetting a coloured run in a note back to the theme's own text colour.
 *
 * Lives here rather than in `NotePage` because it is pure DOM manipulation
 * with no React in it, and because the route imports the PWA registration and
 * the stores — pulling the whole app into a test that only wants to check
 * which elements get unwrapped.
 */

/**
 * A colour no theme uses, applied only so the affected nodes can be found and
 * unwrapped immediately afterwards.
 *
 * `execCommand` gives no way to ask "which elements did the selection touch",
 * and walking the selection by hand means owning range logic across partially
 * selected nodes — the thing `execCommand` is here to avoid. Painting a
 * sentinel and then stripping it borrows the browser's own splitting, which is
 * the part that is genuinely hard.
 */
export const COLOR_SENTINEL = 'rgb(1, 2, 3)';

/**
 * A colour value as numbers, or null when it is not one.
 *
 * Comparing colour STRINGS does not work, and this is the second time that has
 * cost something. The sentinel is written as `rgb(1, 2, 3)`, and Chrome stores
 * it on the element as the hex `#010203` — so a whitespace-and-case comparison
 * matched neither, nothing was stripped, and the near-black sentinel stayed
 * painted on the text. Which is exactly what "restoring the colour turns it
 * black" was.
 *
 * Parsing to numbers is the only comparison that survives the browser
 * rewriting one notation into another, which it is free to do at any time.
 */
export function parseColor(value: string | null): [number, number, number] | null {
  if (!value) return null;
  const text = value.trim().toLowerCase();

  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(text);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];

  const long = /^#([0-9a-f]{6})$/.exec(text);
  if (long) {
    const hex = long[1]!;
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }

  const short = /^#([0-9a-f]{3})$/.exec(text);
  if (short) {
    const hex = short[1]!;
    return [
      parseInt(hex[0]! + hex[0]!, 16),
      parseInt(hex[1]! + hex[1]!, 16),
      parseInt(hex[2]! + hex[2]!, 16),
    ];
  }

  return null;
}

const SENTINEL_RGB = parseColor(COLOR_SENTINEL)!;

/**
 * Is this colour value the sentinel we just painted?
 *
 * By value, not by notation — see `parseColor`.
 */
export function isSentinelColor(value: string | null): boolean {
  const parsed = parseColor(value);
  if (!parsed) return false;
  return (
    parsed[0] === SENTINEL_RGB[0] &&
    parsed[1] === SENTINEL_RGB[1] &&
    parsed[2] === SENTINEL_RGB[2]
  );
}

/**
 * Once the colour is gone, is the element still doing anything?
 *
 * Split out from the DOM walk so the rule can be tested without a document.
 * The rule is the part worth pinning: a `<font>` that also carried a size, or
 * a `<span>` with a background, is still doing a job, and unwrapping it would
 * silently drop formatting nobody asked to lose.
 */
export function isBareAfterColorRemoved(remainingAttributes: readonly string[]): boolean {
  return remainingAttributes.filter((name) => name !== 'color' && name !== 'style').length === 0;
}

/**
 * Remove the sentinel colour, and the element carrying it when that element
 * exists only to carry it.
 *
 * This is what "back to normal" has to mean. Setting the body colour instead
 * would BAKE a hex into the note — correct on the theme active when the button
 * was pressed, wrong in the other one, a bug that appears later and somewhere
 * else. Removing the declaration lets the text inherit, so it follows the
 * theme from then on.
 */
export function stripSentinelColor(root: HTMLElement): void {
  /**
   * Every descendant, not a selector guessing at which ones carry colour.
   *
   * `font[color], [style*="color"]` covered the two shapes seen while writing
   * this, and a selector built from the shapes you happen to have seen is the
   * same mistake as a list of characters that print as `?`. The cost of
   * missing one is that near-black sentinel text is left on screen, which is
   * worse than the original bug. A note is a few hundred nodes; walking all of
   * them is free.
   */
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('*'));

  for (const node of nodes) {
    if (!isSentinelColor(node.getAttribute('color')) && !isSentinelColor(node.style.color)) {
      continue;
    }

    node.removeAttribute('color');
    node.style.removeProperty('color');
    if (node.getAttribute('style') === '') node.removeAttribute('style');

    const remaining = Array.from(node.attributes).map((attribute) => attribute.name);
    if (isBareAfterColorRemoved(remaining)) {
      node.replaceWith(...Array.from(node.childNodes));
    }
  }
}
