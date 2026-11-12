import { SLIDE_W, type Rect } from './geometry';

/**
 * PowerPoint-style snapping for the editor's movable pieces (photos, text box).
 *
 * While a box is dragged, its left / centre / right edges snap to the slide's
 * edges and centre and to the same lines of the other objects on the slide, and
 * likewise top / middle / bottom; while it is resized, its right and bottom
 * edges snap. Within a few screen pixels only, so a box can still be put
 * anywhere (and Alt turns it off in the component). Pure: the component turns
 * the distance in pixels into EMU and draws the returned guide lines.
 */

export interface Guides {
  /** x positions (EMU) of the vertical lines the box is snapped to. */
  x: number[];
  y: number[];
}

const lines = (targets: readonly Rect[], size: number, axis: 'x' | 'y'): number[] => {
  const [pos, len] = axis === 'x' ? (['x', 'w'] as const) : (['y', 'h'] as const);
  return [0, size / 2, size, ...targets.flatMap((t) => [t[pos], t[pos] + t[len] / 2, t[pos] + t[len]])];
};

/** The smallest move that puts one of `anchors` on one of `candidates`, within `threshold`. */
function nearest(anchors: readonly number[], candidates: readonly number[], threshold: number): number | null {
  let best: number | null = null;
  for (const anchor of anchors) {
    for (const line of candidates) {
      const delta = line - anchor;
      if (Math.abs(delta) <= threshold && (best === null || Math.abs(delta) < Math.abs(best))) best = delta;
    }
  }
  return best;
}

/** The candidate lines an anchor ends up exactly on after `delta`. */
const hit = (anchors: readonly number[], candidates: readonly number[], delta: number): number[] =>
  [...new Set(candidates.filter((line) => anchors.some((a) => Math.abs(a + delta - line) < 1)))].sort((a, b) => a - b);

export function snapMove(rect: Rect, targets: readonly Rect[], slideH: number, threshold: number): { rect: Rect; guides: Guides } {
  const xs = lines(targets, SLIDE_W, 'x');
  const ys = lines(targets, slideH, 'y');
  const ax = [rect.x, rect.x + rect.w / 2, rect.x + rect.w];
  const ay = [rect.y, rect.y + rect.h / 2, rect.y + rect.h];
  const dx = nearest(ax, xs, threshold);
  const dy = nearest(ay, ys, threshold);
  return {
    rect: { ...rect, x: Math.round(rect.x + (dx ?? 0)), y: Math.round(rect.y + (dy ?? 0)) },
    guides: { x: dx === null ? [] : hit(ax, xs, dx), y: dy === null ? [] : hit(ay, ys, dy) },
  };
}

/** Bottom-right handle: the right and bottom edges snap; with `aspect` the proportions are kept. */
export function snapResize(
  rect: Rect,
  targets: readonly Rect[],
  slideH: number,
  threshold: number,
  aspect: boolean,
): { rect: Rect; guides: Guides } {
  const xs = lines(targets, SLIDE_W, 'x');
  const ys = lines(targets, slideH, 'y');
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;
  const dx = nearest([right], xs, threshold);
  const dy = nearest([bottom], ys, threshold);

  if (!aspect) {
    return {
      rect: { ...rect, w: Math.round(rect.w + (dx ?? 0)), h: Math.round(rect.h + (dy ?? 0)) },
      guides: { x: dx === null ? [] : hit([right], xs, dx), y: dy === null ? [] : hit([bottom], ys, dy) },
    };
  }

  // A picture: whichever edge is closer decides the width, the other follows the proportions.
  const ratio = rect.h / rect.w;
  const fromX = dx === null ? null : dx;
  const fromY = dy === null ? null : dy / ratio;
  const dw = fromX !== null && (fromY === null || Math.abs(fromX) <= Math.abs(fromY)) ? fromX : fromY;
  if (dw === null) return { rect, guides: { x: [], y: [] } };
  const w = Math.round(rect.w + dw);
  const next = { ...rect, w, h: Math.round(w * ratio) };
  return { rect: next, guides: { x: hit([next.x + next.w], xs, 0), y: hit([next.y + next.h], ys, 0) } };
}
