import type { CanvasLayouts } from './canvasLayout';

/**
 * The phone's own canvas: a grid of small blocks, arranged on the phone.
 *
 * WHY NOT THE LAPTOP CANVAS, SCALED (2026-10-01, replaces the viewer)
 *
 * The first phone canvas drew the laptop arrangement at its laptop width and
 * scaled it down. Every card was there, in its place, at about a third of its
 * size: unreadable without zooming, untappable without zooming, and not
 * movable at all. A canvas you cannot rearrange is only a picture of one.
 *
 * Here each patient is a BLOCK — name, room/bed, DPJP, progress — sized so
 * three fit across a phone, on a grid of cells. A block is moved by dragging
 * it to another cell; dropping on an occupied cell SWAPS the two. Gaps are
 * allowed, so groups can be kept apart the way the free canvas allows.
 *
 * Cells are `{ c, r }` (column, row). The grid is per account, separate from
 * the laptop layout, because the two screens have different shapes; the first
 * time, it is seeded from the laptop layout in reading order so the phone
 * starts out looking like the arrangement already made.
 */

export interface Cell {
  c: number;
  r: number;
}

export type PhoneGrid = Record<string, Cell>;

export function sanitizePhoneGrid(value: unknown, columns: number): PhoneGrid {
  if (!value || typeof value !== 'object') return {};
  const cells = (value as { cells?: unknown }).cells;
  if (!cells || typeof cells !== 'object') return {};
  const out: PhoneGrid = {};
  const taken = new Set<string>();
  for (const [id, raw] of Object.entries(cells as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const c = Number((raw as Record<string, unknown>).c);
    const r = Number((raw as Record<string, unknown>).r);
    if (!Number.isInteger(c) || !Number.isInteger(r) || c < 0 || r < 0 || r > 500) continue;
    // A grid saved on a wider phone: clamp into this one; a clash is left to
    // `placeGrid`, which re-places the second block.
    const cell = { c: Math.min(c, columns - 1), r };
    const key = `${cell.c}:${cell.r}`;
    if (taken.has(key)) continue;
    taken.add(key);
    out[id] = cell;
  }
  return out;
}

/** Reading order of the laptop canvas: top to bottom, then left to right. */
export function readingOrder(ids: readonly string[], layouts: CanvasLayouts): string[] {
  const placed = ids.filter((id) => layouts[id]);
  const rest = ids.filter((id) => !layouts[id]);
  placed.sort((a, b) => {
    const la = layouts[a]!;
    const lb = layouts[b]!;
    // Same visual row when the tops are within half a default card.
    if (Math.abs(la.y - lb.y) > 120) return la.y - lb.y;
    return la.x - lb.x;
  });
  return [...placed, ...rest];
}

/**
 * Every id gets a cell. Stored cells are kept; the rest fill free cells in
 * reading order, in the order given. Ids no longer on the board are dropped.
 */
export function placeGrid(ids: readonly string[], stored: PhoneGrid, columns: number): PhoneGrid {
  const out: PhoneGrid = {};
  const taken = new Set<string>();
  for (const id of ids) {
    const cell = stored[id];
    if (!cell || cell.c >= columns) continue;
    const key = `${cell.c}:${cell.r}`;
    if (taken.has(key)) continue;
    taken.add(key);
    out[id] = cell;
  }
  let slot = 0;
  for (const id of ids) {
    if (out[id]) continue;
    while (taken.has(`${slot % columns}:${Math.floor(slot / columns)}`)) slot += 1;
    const cell = { c: slot % columns, r: Math.floor(slot / columns) };
    taken.add(`${cell.c}:${cell.r}`);
    out[id] = cell;
  }
  return out;
}

/** Move a block to a cell; the block already there (if any) takes its place. */
export function moveBlock(grid: PhoneGrid, id: string, target: Cell): PhoneGrid {
  const from = grid[id];
  if (!from || (from.c === target.c && from.r === target.r)) return grid;
  const next: PhoneGrid = { ...grid, [id]: target };
  const occupant = Object.keys(grid).find(
    (other) => other !== id && grid[other]!.c === target.c && grid[other]!.r === target.r,
  );
  if (occupant) next[occupant] = from;
  return next;
}

export function gridRows(grid: PhoneGrid): number {
  return Object.values(grid).reduce((max, cell) => Math.max(max, cell.r + 1), 0);
}

/** Pack every block up and left, keeping their order. "Rapikan" on the phone. */
export function compactGrid(grid: PhoneGrid, columns: number): PhoneGrid {
  const order = Object.keys(grid).sort((a, b) => {
    const ca = grid[a]!;
    const cb = grid[b]!;
    return ca.r - cb.r || ca.c - cb.c;
  });
  return placeGrid(order, {}, columns);
}
