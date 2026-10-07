/**
 * Drawing on the board canvas (Avi, 2026-10-07).
 *
 * Pen and highlighter strokes on the canvas BACKGROUND, behind the cards: a
 * ring around three patients, an arrow from one to another, a line under a
 * group. What a stroke means lives in the head of whoever drew it, like a
 * sticker, so nothing else in the app reads it.
 *
 * PER DEVICE, PER SCOPE (Avi: "stay on each device")
 *
 * Exactly the sticker rules (`board/stickers.ts`), for the same reasons: a
 * stroke means something by WHERE it is, cards are placed per device, and
 * the two scopes (Pasien saya, Titipan) show different cards at the same
 * place. So strokes live in localStorage, keyed by scope.
 *
 * COORDINATES
 *
 * The sticker convention: `x` a fraction of the canvas width, `y` in pixels.
 * Card positions use the same convention, so a stroke keeps its place
 * relative to the cards when the window is resized, stretching sideways with
 * them. Stored as one flat array per stroke, rounded, to keep a busy board
 * well inside localStorage.
 */

export type DrawTool = 'pen' | 'highlighter';

/** Colours by token, so they follow light and dark mode. Stored by id. */
export const DRAW_COLORS = [
  { id: 'ink', label: 'Hitam', css: 'var(--fg)' },
  { id: 'red', label: 'Merah', css: 'var(--danger)' },
  { id: 'blue', label: 'Biru', css: 'var(--accent)' },
  { id: 'yellow', label: 'Kuning', css: 'var(--discharge-h1)' },
] as const;

export type DrawColor = (typeof DRAW_COLORS)[number]['id'];

export interface Stroke {
  id: string;
  tool: DrawTool;
  color: DrawColor;
  /** Flat `[x0, y0, x1, y1, …]`: x a 0–1 fraction of the canvas width, y in px. */
  points: number[];
}

/** Line width in px. A highlighter is broad and translucent. */
export const STROKE_WIDTH: Record<DrawTool, number> = { pen: 2.5, highlighter: 16 };
export const STROKE_OPACITY: Record<DrawTool, number> = { pen: 1, highlighter: 0.35 };

/**
 * A cap on what is kept: the oldest strokes go first beyond it. 20 000 points
 * is a very busy board and about 300 KB stored, well inside the 5 MB that
 * localStorage gives the whole app.
 */
export const MAX_POINTS = 20_000;

const DRAWING_KEY_PREFIX = 'visite.board.drawing';

export function drawingStorageKey(scope: string): string {
  return `${DRAWING_KEY_PREFIX}.${scope}`;
}

const isColor = (value: unknown): value is DrawColor => DRAW_COLORS.some((color) => color.id === value);

/** Defensive: what comes back from storage may be from an older build, or damaged. */
export function parseDrawing(raw: string | null): Stroke[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry): Stroke[] => {
      if (!entry || typeof entry !== 'object') return [];
      const { id, tool, color, points } = entry as Record<string, unknown>;
      if (typeof id !== 'string' || (tool !== 'pen' && tool !== 'highlighter') || !isColor(color)) return [];
      if (!Array.isArray(points) || points.length < 2 || points.length % 2 !== 0) return [];
      if (!points.every((n) => typeof n === 'number' && Number.isFinite(n))) return [];
      return [{ id, tool, color, points: points as number[] }];
    });
  } catch {
    return [];
  }
}

/** Rounded for storage: x to 1/10 000 of the width, y to 0.1 px. */
function round(points: readonly number[]): number[] {
  return points.map((n, i) => (i % 2 === 0 ? Math.round(n * 10_000) / 10_000 : Math.round(n * 10) / 10));
}

/**
 * Drop points closer than `minPx` to the last one kept. A pointer reports
 * dozens of near-identical positions while it moves slowly; keeping them adds
 * storage and nothing to the line. The last point is always kept, so a stroke
 * ends where the pen lifted.
 */
export function simplify(points: readonly number[], width: number, minPx = 2): number[] {
  if (points.length <= 4) return [...points];
  const out = [points[0]!, points[1]!];
  for (let i = 2; i < points.length - 2; i += 2) {
    const dx = (points[i]! - out[out.length - 2]!) * width;
    const dy = points[i + 1]! - out[out.length - 1]!;
    if (dx * dx + dy * dy >= minPx * minPx) out.push(points[i]!, points[i + 1]!);
  }
  out.push(points[points.length - 2]!, points[points.length - 1]!);
  return out;
}

/** Add a finished stroke, simplified and rounded, trimming the oldest beyond the cap. */
export function addStroke(strokes: readonly Stroke[], stroke: Stroke, width: number): Stroke[] {
  const next = [...strokes, { ...stroke, points: round(simplify(stroke.points, width)) }];
  let total = next.reduce((sum, entry) => sum + entry.points.length / 2, 0);
  while (total > MAX_POINTS && next.length > 1) {
    total -= next[0]!.points.length / 2;
    next.shift();
  }
  return next;
}

/** Distance in px from a point to a segment, with x converted from fractions. */
function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Whether the eraser at (x fraction, y px) touches the stroke. */
export function strokeHit(stroke: Stroke, x: number, y: number, width: number, radiusPx: number): boolean {
  const reach = radiusPx + STROKE_WIDTH[stroke.tool] / 2;
  const px = x * width;
  const { points } = stroke;
  if (points.length === 2) return Math.hypot(points[0]! * width - px, points[1]! - y) <= reach;
  for (let i = 0; i + 3 < points.length; i += 2) {
    if (
      distanceToSegment(px, y, points[i]! * width, points[i + 1]!, points[i + 2]! * width, points[i + 3]!) <= reach
    ) {
      return true;
    }
  }
  return false;
}

/** The eraser removes whole strokes: no half-lines left to clean up. */
export function eraseAt(strokes: readonly Stroke[], x: number, y: number, width: number, radiusPx = 10): Stroke[] {
  const kept = strokes.filter((stroke) => !strokeHit(stroke, x, y, width, radiusPx));
  return kept.length === strokes.length ? (strokes as Stroke[]) : kept;
}

/**
 * SVG path data in pixels. Midpoint quadratic smoothing: each recorded point
 * becomes a control point and the curve passes through the midpoints, which
 * turns a jagged mouse line into a hand-drawn one without moving it.
 */
export function strokePath(points: readonly number[], width: number): string {
  const xy: Array<[number, number]> = [];
  for (let i = 0; i + 1 < points.length; i += 2) xy.push([points[i]! * width, points[i + 1]!]);
  const f = (n: number): string => (Math.round(n * 10) / 10).toString();
  const first = xy[0];
  if (!first) return '';
  if (xy.length === 1) return `M${f(first[0])} ${f(first[1])}l0.01 0`;
  if (xy.length === 2) return `M${f(first[0])} ${f(first[1])}L${f(xy[1]![0])} ${f(xy[1]![1])}`;
  let d = `M${f(first[0])} ${f(first[1])}`;
  for (let i = 1; i < xy.length - 1; i += 1) {
    const [cx, cy] = xy[i]!;
    const [nx, ny] = xy[i + 1]!;
    d += `Q${f(cx)} ${f(cy)} ${f((cx + nx) / 2)} ${f((cy + ny) / 2)}`;
  }
  const last = xy[xy.length - 1]!;
  return `${d}L${f(last[0])} ${f(last[1])}`;
}

/** The lowest point drawn, so the drawing layer can be as tall as its strokes. */
export function drawingBottom(strokes: readonly Stroke[]): number {
  let bottom = 0;
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.points.length; i += 2) bottom = Math.max(bottom, stroke.points[i]!);
  }
  return bottom;
}
