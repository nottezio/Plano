import { headingDate } from '@/domain/lab/labMeta';
import type { ClinicalDate } from '@/domain/types';
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
