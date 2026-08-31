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

const normalise = (value: string): string => value.replace(/\s/g, '').toLowerCase();

/**
 * Is this colour value the sentinel we just painted?
 *
 * Compared with whitespace and case removed, because `rgb(1, 2, 3)` comes back
 * as `rgb(1,2,3)` from `style.color` and as the original string from a `color`
 * attribute, and a straight equality check would match one and miss the other.
 */
export function isSentinelColor(value: string | null): boolean {
  return value !== null && normalise(value) === normalise(COLOR_SENTINEL);
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
  // `<font color>` and `<span style="color">` are both produced, depending on
  // the browser and on `styleWithCSS`. Both have to go.
  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>('font[color], [style*="color"]'),
  );

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
