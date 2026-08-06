import { DONE_TOKEN, tokenForIndex } from './colorTokens';
import type {
  ChecklistItemDef,
  ChecklistTickState,
  DailyChecklist,
} from './types';

/**
 * SPEC 9.2 / 9.3 — checklist state and the colour it implies.
 *
 * Pure. No React, no Firebase, no clock. In particular there is no reset
 * function anywhere in this file: the daily reset is a property of the schema
 * (the checklist doc id is the clinical date), so "reset" means "read a
 * document that does not exist yet". A reset routine here would be a second,
 * fallible source of truth for something the data model already guarantees.
 *
 * Nothing below assumes seven items. N is whatever the user configured.
 */

export type ChecklistStates = Readonly<Record<string, ChecklistTickState>>;

const UNCHECKED: ChecklistTickState = { done: false, at: null, by: null };

/** Active items in display order. Disabled items keep their history but hide. */
export function activeItems(items: readonly ChecklistItemDef[]): ChecklistItemDef[] {
  return items.filter((item) => item.active).sort((a, b) => a.order - b.order);
}

/**
 * Fills gaps so callers never branch on undefined.
 *
 * A missing document and a document with no ticks are the same state by
 * design, and an item added after a day was ticked simply reads as unchecked
 * for that day rather than corrupting it.
 */
export function resolveStates(
  items: readonly ChecklistItemDef[],
  checklist: DailyChecklist | null,
): ChecklistStates {
  const stored = checklist?.items ?? {};
  const resolved: Record<string, ChecklistTickState> = {};
  for (const item of items) {
    resolved[item.id] = stored[item.id] ?? UNCHECKED;
  }
  return resolved;
}

export function isDone(states: ChecklistStates, itemId: string): boolean {
  return states[itemId]?.done === true;
}

/**
 * The lowest-order active item still unchecked — i.e. *what still needs doing*.
 * Returns null when the day is complete.
 */
export function pendingItem(
  items: readonly ChecklistItemDef[],
  states: ChecklistStates,
): ChecklistItemDef | null {
  return activeItems(items).find((item) => !isDone(states, item.id)) ?? null;
}

/**
 * SPEC 9.3 — card colour.
 *
 * A manual override beats everything; otherwise the colour is the pending
 * item's token; all done → the `done` token. With zero active items there is
 * nothing left to do, so the card reads as done rather than falling back to a
 * neutral colour that would look like an error.
 */
export function resolveCardColor(
  items: readonly ChecklistItemDef[],
  states: ChecklistStates,
  override?: string | null,
): string {
  if (override) return override;
  const pending = pendingItem(items, states);
  return pending ? pending.colorToken : DONE_TOKEN;
}

export interface ProgressSegment {
  itemId: string;
  label: string;
  colorToken: string;
  done: boolean;
}

export interface ChecklistProgress {
  /** N = active item count. The strip has exactly this many segments. */
  total: number;
  doneCount: number;
  complete: boolean;
  segments: ProgressSegment[];
  /** Short label of what is still pending — the non-colour signal (SPEC 9.3). */
  pendingLabel: string | null;
}

/**
 * SPEC 9.3 accessibility clause: colour is never the only signal. Every card
 * renders an N-segment strip plus a chip naming the pending item, so the board
 * is readable with any form of colour blindness and in greyscale.
 */
export function checklistProgress(
  items: readonly ChecklistItemDef[],
  states: ChecklistStates,
): ChecklistProgress {
  const active = activeItems(items);
  const segments = active.map((item) => ({
    itemId: item.id,
    label: item.label,
    colorToken: item.colorToken,
    done: isDone(states, item.id),
  }));
  const doneCount = segments.filter((segment) => segment.done).length;
  const pending = pendingItem(items, states);

  return {
    total: segments.length,
    doneCount,
    complete: segments.length > 0 && doneCount === segments.length,
    segments,
    pendingLabel: pending ? pending.label : null,
  };
}

/** Board filter chips: one "belum …" per active item (SPEC F2). */
export interface PendingFilter {
  itemId: string;
  label: string;
  colorToken: string;
}

export function pendingFilters(items: readonly ChecklistItemDef[]): PendingFilter[] {
  return activeItems(items).map((item) => ({
    itemId: item.id,
    label: `Belum ${item.label.toLowerCase()}`,
    colorToken: item.colorToken,
  }));
}

/**
 * The complete done-map for a day, optionally with one item toggled.
 *
 * Two invariants live here, and both exist because this map is written
 * wholesale into the board cache (see types.ts):
 *
 *  1. Keys come from the CURRENT definitions only, so a tick recorded against
 *     an item that no longer exists cannot ride along forever.
 *  2. Disabled items are included, not dropped — their history must survive
 *     being hidden, or re-enabling an item would silently clear its past.
 */
export function buildDoneMap(
  items: readonly ChecklistItemDef[],
  states: ChecklistStates,
  toggleId?: string,
  toggleTo?: boolean,
): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const item of items) map[item.id] = isDone(states, item.id);
  if (toggleId !== undefined && toggleTo !== undefined) map[toggleId] = toggleTo;
  return map;
}

/* ------------------------------------------------------------------ *
 * Pure editors for the Settings screen (SPEC 15).                     *
 * Kept here, not in the UI, so reordering rules stay unit-testable.   *
 * ------------------------------------------------------------------ */

/**
 * Sorts by `order`, then renumbers to a contiguous 1..N.
 *
 * Use this to normalise *input* — a list whose `order` values are the truth.
 * After a positional splice the `order` values are stale, and sorting by them
 * would undo the move; use `renumberByPosition` there instead.
 */
export function normalizeOrders(items: readonly ChecklistItemDef[]): ChecklistItemDef[] {
  return renumberByPosition([...items].sort((a, b) => a.order - b.order));
}

/** Renumbers 1..N by array position, treating position as the truth. */
export function renumberByPosition(items: readonly ChecklistItemDef[]): ChecklistItemDef[] {
  return items.map((item, index) => ({ ...item, order: index + 1 }));
}

export function addChecklistItem(
  items: readonly ChecklistItemDef[],
  id: string,
  label: string,
): ChecklistItemDef[] {
  const next: ChecklistItemDef = {
    id,
    label,
    order: items.length + 1,
    colorToken: tokenForIndex(items.length + 1),
    active: true,
  };
  return normalizeOrders([...items, next]);
}

export function renameChecklistItem(
  items: readonly ChecklistItemDef[],
  itemId: string,
  label: string,
): ChecklistItemDef[] {
  // Lookup is by id, never by label, so a rename relabels history retroactively
  // instead of orphaning every past tick (SPEC 15).
  return items.map((item) => (item.id === itemId ? { ...item, label } : item));
}

export function recolorChecklistItem(
  items: readonly ChecklistItemDef[],
  itemId: string,
  colorToken: string,
): ChecklistItemDef[] {
  return items.map((item) => (item.id === itemId ? { ...item, colorToken } : item));
}

/**
 * Soft-disable. There is no remove function: deleting a definition would
 * orphan every historical tick keyed by its id (SPEC 6.3).
 */
export function setChecklistItemActive(
  items: readonly ChecklistItemDef[],
  itemId: string,
  active: boolean,
): ChecklistItemDef[] {
  return items.map((item) => (item.id === itemId ? { ...item, active } : item));
}

export function moveChecklistItem(
  items: readonly ChecklistItemDef[],
  itemId: string,
  toIndex: number,
): ChecklistItemDef[] {
  const ordered = normalizeOrders(items);
  const fromIndex = ordered.findIndex((item) => item.id === itemId);
  if (fromIndex === -1) return ordered;

  const bounded = Math.max(0, Math.min(toIndex, ordered.length - 1));
  const moved = ordered.splice(fromIndex, 1)[0];
  if (!moved) return ordered;
  ordered.splice(bounded, 0, moved);
  // Position is now the truth; the `order` fields are stale. Sorting by them
  // here would silently reverse the move the user just made.
  return renumberByPosition(ordered);
}
