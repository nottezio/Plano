/**
 * Where a floating window sits and how big it is (2026-10-17). Shared by the
 * List Maker's SOAP boxes and its Tempel box: both are dragged by their
 * header and resized from a corner, and both must stay wholly on screen — a
 * box whose bottom corner went below the window could no longer be resized,
 * and its drag selected page text instead.
 */
export interface Geometry {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Viewport {
  width: number;
  height: number;
  /** The highest a box may sit: under the desktop tab strip, when there is one. */
  top: number;
}

export function clampGeometry(g: Geometry, view: Viewport, min: { w: number; h: number }): Geometry {
  const w = Math.min(Math.max(g.w, min.w), view.width - 16);
  const x = Math.min(Math.max(g.x, 8), view.width - w - 8);
  const y = Math.min(Math.max(g.y, view.top), view.height - min.h - 8);
  const h = Math.min(Math.max(g.h, min.h), view.height - y - 8);
  return { x, y, w, h };
}

/** The window now, below the desktop tab strip (2026-10-16): it draws above the boxes. */
export function currentViewport(): Viewport {
  const top = (document.querySelector('[data-app-tabs]')?.getBoundingClientRect().bottom ?? 0) + 8;
  return { width: window.innerWidth, height: window.innerHeight, top };
}

/** A stored geometry, or null when absent or malformed. */
export function readStoredGeometry(raw: string | null): Geometry | null {
  try {
    const data = JSON.parse(raw ?? 'null') as Partial<Geometry> | null;
    if (data && [data.x, data.y, data.w, data.h].every((v) => typeof v === 'number' && Number.isFinite(v))) return data as Geometry;
  } catch {
    // Unreadable: none.
  }
  return null;
}

/** A pointer drag applied: moved by the header, or resized from the bottom-right corner. */
export function dragGeometry(from: Geometry, kind: 'move' | 'resize', dx: number, dy: number): Geometry {
  return kind === 'move' ? { ...from, x: from.x + dx, y: from.y + dy } : { ...from, w: from.w + dx, h: from.h + dy };
}
