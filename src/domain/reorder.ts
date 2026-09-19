/**
 * Move one item to another's position, within a FILTERED view of a longer list.
 *
 * Pulled out of the Catatan tabs because the dangerous part is not the splice.
 * The tabs show one shelf at a time, with archived notes hidden, so the order
 * the user sees is a subset — and rewriting the stored array from that subset
 * would drop everything the filter hides. That failure is silent and total: a
 * shelf of archived notes disappears and the only clue is that the save
 * succeeded.
 *
 * So the rebuild walks the FULL list and hands each visible slot its new
 * occupant in turn. Every hidden item keeps its exact index.
 */
export function reorderWithinVisible<T>(
  all: readonly T[],
  visible: readonly T[],
  idOf: (item: T) => string,
  fromId: string,
  toId: string,
): T[] {
  if (fromId === toId) return [...all];

  const order = visible.map(idOf);
  const from = order.indexOf(fromId);
  const to = order.indexOf(toId);
  if (from === -1 || to === -1) return [...all];

  order.splice(to, 0, ...order.splice(from, 1));

  const byId = new Map(all.map((item) => [idOf(item), item]));
  const isVisible = new Set(visible.map(idOf));
  let slot = 0;

  return all.map((item) =>
    isVisible.has(idOf(item)) ? (byId.get(order[slot++]!) ?? item) : item,
  );
}

/**
 * Move one item to sit immediately BEFORE or AFTER another, within the same
 * filtered view.
 *
 * Separate from `reorderWithinVisible` because a drop has a side. "Move to
 * where that one is" cannot express "put it under the last card", and a drag
 * whose result does not match the line the user was shown is the reason the
 * first attempt at this was confusing.
 *
 * The destination index is computed AFTER the dragged item is removed, so the
 * result is always "it ends up on the side of the target you were shown",
 * whichever direction the drag went. Computing it before removal is the
 * classic off-by-one that makes a downward drag land one place short.
 */
export function moveBeside<T>(
  all: readonly T[],
  visible: readonly T[],
  idOf: (item: T) => string,
  fromId: string,
  targetId: string,
  place: 'before' | 'after',
): T[] {
  if (fromId === targetId) return [...all];

  const order = visible.map(idOf);
  const from = order.indexOf(fromId);
  if (from === -1 || !order.includes(targetId)) return [...all];

  order.splice(from, 1);
  const target = order.indexOf(targetId);
  order.splice(place === 'before' ? target : target + 1, 0, fromId);

  const byId = new Map(all.map((item) => [idOf(item), item]));
  const isVisible = new Set(visible.map(idOf));
  let slot = 0;

  return all.map((item) =>
    isVisible.has(idOf(item)) ? (byId.get(order[slot++]!) ?? item) : item,
  );
}
