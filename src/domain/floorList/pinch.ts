/**
 * Pinch-to-zoom for the denah on a phone (2026-10-14, Avi: "zoomable by
 * finger without clicking Muat di layar, without zooming all the page").
 *
 * Before, the plan had two sizes — fit to the screen, or full desk size via
 * a button — and a pinch zoomed the whole page (header, tabs and all). Now
 * the plan's own box takes the pinch (`touch-action: pan-x pan-y` stops the
 * browser zooming the page for a gesture that starts there) and the scale is
 * continuous between "whole floor fits" and twice full size.
 *
 * Pure numbers here; `DenahCanvas` does the DOM.
 */

/** Twice the desk size: room text larger than on a laptop, for a small screen. */
export const MAX_ZOOM = 2;

/** A scale kept between fit (`min`) and MAX_ZOOM. Never below fit: smaller than the screen helps nobody. */
export function clampZoom(scale: number, min: number): number {
  if (!Number.isFinite(scale)) return min;
  return Math.min(MAX_ZOOM, Math.max(min, scale));
}

/**
 * The stored choice. `null` means "fit", which follows the screen width.
 * Older versions stored '1' (full size) or '0' (fit); both still read.
 */
export function readStoredZoom(value: string | null): number | null {
  if (value === null || value === '0' || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(MAX_ZOOM, n) : null;
}

/** One tap of the zoom buttons: a quarter step, so three taps go from fit to about full size. */
export const ZOOM_STEP = 1.25;

/**
 * Zoom from `scale` to `next` about a point on the screen (the buttons zoom
 * about the middle of what is in view), returning the sideways scroll and the
 * page's vertical correction that keep the plan point under it in place.
 * Same arithmetic as `pinchStep`, for a zoom with no fingers to follow.
 */
export function zoomAbout(
  scale: number,
  next: number,
  point: { x: number; y: number },
  box: { left: number; top: number; scrollLeft: number },
): { scrollLeft: number; scrollBy: number } {
  const planX = (point.x - box.left + box.scrollLeft) / scale;
  const planY = (point.y - box.top) / scale;
  return {
    scrollLeft: Math.max(0, planX * next - (point.x - box.left)),
    scrollBy: planY * next + box.top - point.y,
  };
}

export interface PinchStart {
  /** Distance between the two fingers at the start, px. */
  distance: number;
  scale: number;
  /** The point under the fingers' midpoint, in unscaled plan coordinates. */
  planX: number;
  planY: number;
}

/**
 * Where the pinch began: the midpoint of the fingers, converted into the
 * plan's own coordinates so the same spot can be kept under the fingers.
 * `boxLeft`/`boxTop` are the plan box's screen position; `scrollLeft` its
 * sideways scroll.
 */
export function pinchStart(
  a: { x: number; y: number },
  b: { x: number; y: number },
  box: { left: number; top: number; scrollLeft: number },
  scale: number,
): PinchStart {
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  return {
    distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
    scale,
    planX: (midX - box.left + box.scrollLeft) / scale,
    planY: (midY - box.top) / scale,
  };
}

/**
 * One step of the pinch: the new scale, and how far to scroll so the plan
 * point that was under the fingers is under their midpoint again.
 * `scrollLeft` is the box's new sideways scroll; `scrollBy` the page's
 * vertical scroll correction (the box's top moves on the page as the plan
 * grows above the fingers).
 */
export function pinchStep(
  start: PinchStart,
  a: { x: number; y: number },
  b: { x: number; y: number },
  box: { left: number; top: number },
  min: number,
): { scale: number; scrollLeft: number; scrollBy: number } {
  const distance = Math.hypot(a.x - b.x, a.y - b.y);
  const scale = clampZoom(start.scale * (distance / start.distance), min);
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  return {
    scale,
    scrollLeft: Math.max(0, start.planX * scale - (midX - box.left)),
    scrollBy: start.planY * scale + box.top - midY,
  };
}
