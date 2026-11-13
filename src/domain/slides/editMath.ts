import { headingDate } from '@/domain/lab/labMeta';
import type { ClinicalDate } from '@/domain/types';
import type { PhotoCrop } from './deck';
import { SLIDE_W, type Rect } from './geometry';

/**
 * The editor's photo moves, in slide EMU. Pure so the drag and keyboard paths
 * share one rule set. A photo may leave the slide (owner: "it doesn't matter as
 * long as the main text gets seen"); only a minimum size is enforced, so a
 * photo can never shrink to something nobody can grab again.
 */

const MIN_W = Math.round(SLIDE_W * 0.05);
const STEP = Math.round(SLIDE_W * 0.01);
const BIG_STEP = Math.round(SLIDE_W * 0.05);

export function rectAfterDrag(start: Rect, dx: number, dy: number): Rect {
  return { ...start, x: Math.round(start.x + dx), y: Math.round(start.y + dy) };
}

/** Bottom-right handle: the top-left corner stays put, aspect ratio is kept. */
export function rectAfterResize(start: Rect, dx: number): Rect {
  const w = Math.max(MIN_W, Math.round(start.w + dx));
  return { ...start, w, h: Math.round((start.h * w) / start.w) };
}

/** At least this share of the picture stays visible in each direction. */
export const CROP_MIN_VISIBLE = 0.1;

export const NO_CROP: PhotoCrop = { l: 0, t: 0, r: 0, b: 0 };

export const hasCrop = (crop: PhotoCrop | undefined): crop is PhotoCrop =>
  Boolean(crop && (crop.l > 0 || crop.t > 0 || crop.r > 0 || crop.b > 0));

/** Each edge 0 or more, and the two opposite edges together leave `CROP_MIN_VISIBLE` of the picture. */
export function clampCrop(crop: PhotoCrop): PhotoCrop {
  const edge = (v: number, other: number): number => Math.min(Math.max(0, v), 1 - CROP_MIN_VISIBLE - other);
  const l = edge(crop.l, 0);
  const t = edge(crop.t, 0);
  return { l, t, r: edge(crop.r, l), b: edge(crop.b, t) };
}

/**
 * A placed photo after its crop changed, keeping the visible pixels where they
 * are on the slide (PowerPoint's behaviour): the scale of the whole picture is
 * fixed, only the window onto it moves. Undo is exact (cropping back restores the rect).
 */
export function rectAfterCrop(rect: Rect, from: PhotoCrop | undefined, to: PhotoCrop | undefined): Rect {
  const a = from ?? NO_CROP;
  const b = to ?? NO_CROP;
  const fullW = rect.w / (1 - a.l - a.r);
  const fullH = rect.h / (1 - a.t - a.b);
  return {
    x: Math.round(rect.x + (b.l - a.l) * fullW),
    y: Math.round(rect.y + (b.t - a.t) * fullH),
    w: Math.round(fullW * (1 - b.l - b.r)),
    h: Math.round(fullH * (1 - b.t - b.b)),
  };
}

/** A text box: bottom-right handle, width and height change independently (it is not a picture). */
export function rectAfterBoxResize(start: Rect, dx: number, dy: number): Rect {
  return { ...start, w: Math.max(MIN_W, Math.round(start.w + dx)), h: Math.max(MIN_W, Math.round(start.h + dy)) };
}

export function nudge(rect: Rect, key: string, big: boolean): Rect | null {
  const step = big ? BIG_STEP : STEP;
  switch (key) {
    case 'ArrowLeft':
      return { ...rect, x: rect.x - step };
    case 'ArrowRight':
      return { ...rect, x: rect.x + step };
    case 'ArrowUp':
      return { ...rect, y: rect.y - step };
    case 'ArrowDown':
      return { ...rect, y: rect.y + step };
    default:
      return null;
  }
}

export function slideMzFileName(name: string, date: ClinicalDate): string {
  const safe = name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  return `${['PPT', safe, headingDate(date)].filter(Boolean).join(' - ')}.pptx`;
}
