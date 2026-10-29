import {
  DEFAULT_SHELF_TITLE,
  DEFAULT_W,
  GAP_PX,
  ROW_STEP,
  SHELF_HEADER_PX,
  SHELF_PREFIX,
  isShelfId,
  shelfOf,
  unshelve,
  type CanvasLayouts,
  type CardLayout,
} from './canvasLayout';
import { PHONE_SHELF_TITLE_MAX, type PhoneScope, type PhoneShelf } from './phoneShelf';

/**
 * One set of shelves for the laptop canvas and the phone (29 Oct 2026, Avi:
 * "sync the Canvas state between desktop and mobile ... the basket/shelf
 * content, not the positioning").
 *
 * The laptop keeps shelves in the canvas layouts (`rak:*` entries, and
 * `shelf` / `shelfAt` on each card) and mirrors them to the account
 * (`boardCanvas`). The phone used to keep its own list on the side
 * (`boardPhoneGrid.shelves`), so neither ever saw the other's. Now the
 * mirrored layouts are the one copy: the phone reads its shelves out of them
 * (`shelvesFromLayouts`), writes its edits back into them
 * (`layoutsWithShelves` + `shelfPatch`), and the laptop takes the shelf part
 * of the account's copy as it changes (`applyRemoteShelves`). Positions are
 * never shared back: each screen has its own.
 */

const scopeOf = (layout: CardLayout): PhoneScope => (layout.scope === 'temporary' ? 'temporary' : 'mine');

/** Every shelf in the layouts, both board views, with the cards on it in the order they were put there. */
export function shelvesFromLayouts(layouts: CanvasLayouts): PhoneShelf[] {
  const shelves = Object.keys(layouts)
    .filter(isShelfId)
    .sort((a, b) => layouts[a]!.y - layouts[b]!.y || layouts[a]!.x - layouts[b]!.x || a.localeCompare(b));
  const members = new Map<string, string[]>(shelves.map((id) => [id, []]));
  Object.keys(layouts)
    .filter((id) => !isShelfId(id))
    .sort((a, b) => (layouts[a]!.shelfAt ?? 0) - (layouts[b]!.shelfAt ?? 0) || a.localeCompare(b))
    .forEach((id) => {
      const shelf = shelfOf(layouts, id);
      if (shelf) members.get(shelf)!.push(id);
    });
  return shelves.map((id) => {
    const layout = layouts[id]!;
    return {
      id,
      title: layout.title || DEFAULT_SHELF_TITLE,
      scope: scopeOf(layout),
      ...(layout.closed ? { closed: true as const } : {}),
      ids: members.get(id)!,
    };
  });
}

/** The phone's pre-29-Oct shelf ids (`ps:…`) become canvas shelf ids, once. */
export function canvasShelfId(id: string): string {
  return id.startsWith(SHELF_PREFIX) ? id : `${SHELF_PREFIX}${id.replace(/^ps:/, '')}`;
}

/** Same shelf state, for either of two layouts' entries (position is not part of it). */
function sameEntry(a: CardLayout | undefined, b: CardLayout | undefined): boolean {
  if (!a || !b) return a === b;
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.w === b.w &&
    a.hMax === b.hMax &&
    a.hMaxWithNote === b.hMaxWithNote &&
    a.shelf === b.shelf &&
    a.shelfAt === b.shelfAt &&
    a.title === b.title &&
    a.closed === b.closed &&
    a.scope === b.scope
  );
}

/**
 * The layouts after the phone edited its shelves (`shelves`: every shelf of
 * both views, as `shelvesFromLayouts` gave them, edited).
 *
 * Only shelf state changes. A new shelf goes under everything already placed;
 * a patient put on a shelf with no layout of its own gets one, which is
 * dropped from the canvas anyway while it is shelved; a patient taken off
 * (or whose shelf was removed) comes back just under where the shelf stands,
 * as "Keluarkan" does on the laptop.
 */
export function layoutsWithShelves(previous: CanvasLayouts, shelves: readonly PhoneShelf[], now = Date.now()): CanvasLayouts {
  const next: CanvasLayouts = { ...previous };
  const wanted = new Map(shelves.map((shelf) => [canvasShelfId(shelf.id), shelf]));
  const bottom = Object.values(previous).reduce((max, layout) => Math.max(max, layout.y + ROW_STEP), 0);

  // Shelves: create, rename, fold. Gone ones are dropped below, after their cards leave.
  let below = bottom;
  for (const [id, shelf] of wanted) {
    const existing = previous[id];
    const title = shelf.title.trim().slice(0, PHONE_SHELF_TITLE_MAX) || DEFAULT_SHELF_TITLE;
    const base: CardLayout = existing ?? { x: 0, y: below, w: Math.max(DEFAULT_W, 0.25), hMax: 0 };
    if (!existing) below += SHELF_HEADER_PX + GAP_PX;
    const { closed: _closed, scope: _scope, ...rest } = base;
    next[id] = {
      ...rest,
      title,
      ...(shelf.closed ? { closed: true as const } : {}),
      ...(shelf.scope === 'temporary' ? { scope: 'temporary' } : {}),
    };
  }

  // Cards: on the shelf they are listed on, off every other.
  const placed = new Set<string>();
  for (const [shelfId, shelf] of wanted) {
    const stand = next[shelfId]!;
    let last = Math.max(
      0,
      ...shelf.ids.map((id) => (previous[id]?.shelf === shelfId ? previous[id]!.shelfAt ?? 0 : 0)),
    );
    shelf.ids.forEach((id) => {
      if (placed.has(id) || isShelfId(id)) return;
      placed.add(id);
      const existing = previous[id];
      if (existing?.shelf === shelfId) return;
      last = Math.max(now, last + 1);
      next[id] = { ...(existing ?? { x: stand.x, y: stand.y, w: DEFAULT_W, hMax: 0 }), shelf: shelfId, shelfAt: last };
    });
  }
  let n = 0;
  for (const [id, layout] of Object.entries(previous)) {
    if (isShelfId(id) || !layout.shelf || placed.has(id)) continue;
    const stand = previous[layout.shelf];
    next[id] = unshelve(layout, stand ? { x: stand.x, y: stand.y + SHELF_HEADER_PX + GAP_PX + n * ROW_STEP } : undefined);
    n += 1;
  }
  for (const id of Object.keys(previous)) if (isShelfId(id) && !wanted.has(id)) delete next[id];
  return next;
}

/** What differs between two layouts, as the account's field edits: an entry to set, or `null` to remove. */
export function shelfPatch(previous: CanvasLayouts, next: CanvasLayouts): Record<string, CardLayout | null> {
  const patch: Record<string, CardLayout | null> = {};
  for (const [id, layout] of Object.entries(next)) if (!sameEntry(previous[id], layout)) patch[id] = layout;
  for (const id of Object.keys(previous)) if (!(id in next)) patch[id] = null;
  return patch;
}

/** The part of the layouts that is shelf state, as one comparable string. */
export function shelfKey(layouts: CanvasLayouts): string {
  return JSON.stringify(
    shelvesFromLayouts(layouts).map((shelf) => [shelf.id, shelf.title, shelf.scope, shelf.closed === true, shelf.ids.map((id) => [id, layouts[id]!.shelfAt ?? 0])]),
  );
}

/**
 * The laptop's layouts with the account's shelves put in: titles, folds, which
 * cards are on which shelf and in what order. Positions stay the laptop's own,
 * except a card the other device took off a shelf, which comes back where that
 * device put it (just under the shelf). Returns `local` itself when nothing
 * differs.
 */
export function applyRemoteShelves(local: CanvasLayouts, remote: CanvasLayouts): CanvasLayouts {
  if (shelfKey(local) === shelfKey(remote)) return local;
  const next: CanvasLayouts = { ...local };
  for (const [id, layout] of Object.entries(remote)) {
    if (!isShelfId(id)) continue;
    const { closed, scope, title } = layout;
    const own = local[id];
    if (!own) {
      next[id] = layout;
      continue;
    }
    const { closed: _closed, scope: _scope, ...rest } = own;
    next[id] = { ...rest, ...(title ? { title } : {}), ...(closed ? { closed: true as const } : {}), ...(scope ? { scope } : {}) };
  }
  for (const id of Object.keys(local)) if (isShelfId(id) && !remote[id]) delete next[id];

  for (const id of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    if (isShelfId(id)) continue;
    const there = remote[id] && shelfOf(remote, id) ? remote[id] : undefined;
    const here = local[id] && shelfOf(local, id) ? local[id] : undefined;
    if (there) {
      if (here && here.shelf === there.shelf && here.shelfAt === there.shelfAt) continue;
      next[id] = { ...(local[id] ?? remote[id]!), shelf: there.shelf!, shelfAt: there.shelfAt ?? 0 };
    } else if (here) {
      const moved = remote[id];
      next[id] = unshelve(here, moved ? { x: moved.x, y: moved.y } : undefined);
    }
  }
  return next;
}
