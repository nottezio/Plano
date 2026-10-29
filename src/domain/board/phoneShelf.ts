/**
 * Shelves on the phone canvas (26 Oct 2026, Avi: "add shelves or a basket in
 * the mobile canvas view"). The laptop canvas has had Shelf since 16 Oct: a
 * drawer for patients you are done with on the floor but not on paper
 * (pulang, berkas belum selesai). The phone grid is its own model
 * (`phoneGrid`), so its shelves are too: a named list of patient ids, one set
 * per board view (`mine` / `temporary`), kept beside the grid cells on the
 * account.
 *
 * 29 Oct 2026: those lists are now the laptop's shelves (`shelfSync`); this file
 * is the phone's editing of them, and the format the old stored list was in.
 *
 * A shelved patient leaves the grid (its cell is free again) and is listed on
 * the shelf, in the order it was put there. Taking it off, or removing the
 * shelf, puts it back on the grid: the first free cell, in reading order.
 */

import { newShelfId } from './canvasLayout';

export type PhoneScope = 'mine' | 'temporary';

export interface PhoneShelf {
  id: string;
  title: string;
  scope: PhoneScope;
  /** Folded to its header. */
  closed?: true;
  /** Patient ids, in the order they were put on. */
  ids: string[];
}

export const PHONE_SHELF_TITLE = 'Shelf';
export const PHONE_SHELF_TITLE_MAX = 40;
/** Per board view: more than this is clutter on a phone, not a drawer. */
export const MAX_PHONE_SHELVES = 6;
const MAX_IDS = 300;

export function sanitizePhoneShelves(value: unknown): PhoneShelf[] {
  const raw = value && typeof value === 'object' ? (value as { shelves?: unknown }).shelves : undefined;
  if (!Array.isArray(raw)) return [];
  const out: PhoneShelf[] = [];
  const seenShelf = new Set<string>();
  const seenId = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.id !== 'string' || !e.id || seenShelf.has(e.id)) continue;
    seenShelf.add(e.id);
    const scope: PhoneScope = e.scope === 'temporary' ? 'temporary' : 'mine';
    const title = typeof e.title === 'string' ? e.title.trim().slice(0, PHONE_SHELF_TITLE_MAX) : '';
    // A patient is on one shelf only: the first one named wins.
    const ids = (Array.isArray(e.ids) ? e.ids : [])
      .filter((id): id is string => typeof id === 'string' && id.length > 0 && !seenId.has(id))
      .slice(0, MAX_IDS);
    ids.forEach((id) => seenId.add(id));
    out.push({ id: e.id, title: title || PHONE_SHELF_TITLE, scope, ...(e.closed === true ? { closed: true as const } : {}), ids });
  }
  return out;
}

/** The ids on any of these shelves. */
export function shelvedIds(shelves: readonly PhoneShelf[]): Set<string> {
  return new Set(shelves.flatMap((shelf) => shelf.ids));
}

export function shelfOfPatient(shelves: readonly PhoneShelf[], id: string): string | null {
  return shelves.find((shelf) => shelf.ids.includes(id))?.id ?? null;
}

/** A new empty shelf; none once the view has `MAX_PHONE_SHELVES`. */
export function addPhoneShelf(shelves: readonly PhoneShelf[], scope: PhoneScope, now = Date.now()): PhoneShelf[] {
  if (shelves.filter((shelf) => shelf.scope === scope).length >= MAX_PHONE_SHELVES) return [...shelves];
  // A canvas shelf id (`rak:…`): the phone's shelves are the laptop's (see `shelfSync`).
  let id = newShelfId(now);
  for (let n = 2; shelves.some((shelf) => shelf.id === id); n += 1) id = `${newShelfId(now)}-${n}`;
  return [...shelves, { id, title: PHONE_SHELF_TITLE, scope, ids: [] }];
}

/** A blank name goes back to "Shelf". */
export function renamePhoneShelf(shelves: readonly PhoneShelf[], id: string, title: string): PhoneShelf[] {
  const next = title.trim().slice(0, PHONE_SHELF_TITLE_MAX) || PHONE_SHELF_TITLE;
  return shelves.map((shelf) => (shelf.id === id ? { ...shelf, title: next } : shelf));
}

export function togglePhoneShelf(shelves: readonly PhoneShelf[], id: string): PhoneShelf[] {
  return shelves.map((shelf) => {
    if (shelf.id !== id) return shelf;
    const { closed: _closed, ...rest } = shelf;
    return shelf.closed ? rest : { ...rest, closed: true as const };
  });
}

/** Removing a shelf only removes the drawer: its patients are back on the grid. */
export function removePhoneShelf(shelves: readonly PhoneShelf[], id: string): PhoneShelf[] {
  return shelves.filter((shelf) => shelf.id !== id);
}

/** Put a patient on a shelf, at the end, or at `index` among the shelf's patients; off any other shelf. */
export function putOnShelf(shelves: readonly PhoneShelf[], id: string, shelfId: string, index?: number): PhoneShelf[] {
  if (!shelves.some((shelf) => shelf.id === shelfId)) return [...shelves];
  return shelves.map((shelf) => {
    const rest = shelf.ids.filter((other) => other !== id);
    if (shelf.id !== shelfId) return rest.length === shelf.ids.length ? shelf : { ...shelf, ids: rest };
    const at = index === undefined ? rest.length : Math.max(0, Math.min(rest.length, index));
    return { ...shelf, ids: [...rest.slice(0, at), id, ...rest.slice(at)] };
  });
}

/** Back on the grid. */
export function takeOffShelf(shelves: readonly PhoneShelf[], id: string): PhoneShelf[] {
  return shelves.map((shelf) => (shelf.ids.includes(id) ? { ...shelf, ids: shelf.ids.filter((other) => other !== id) } : shelf));
}

/**
 * One view's shelves as they were edited, merged back among all of them:
 * the other view's are kept as they were, in place.
 */
export function mergeScope(all: readonly PhoneShelf[], scope: PhoneScope, edited: readonly PhoneShelf[]): PhoneShelf[] {
  return [...all.filter((shelf) => shelf.scope !== scope), ...edited.map((shelf) => ({ ...shelf, scope }))];
}
