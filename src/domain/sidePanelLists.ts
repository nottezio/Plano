/** The sections of the "Tab status" sidebar. */
export type SidePanelTab = 'catatan' | 'checklist' | 'todos' | 'tanggal';

/** The tab to open on arrival: the first list that still has something left. */
export function firstOpenTab(checklistOpen: number, todosOpen: number): SidePanelTab {
  if (checklistOpen > 0) return 'checklist';
  return todosOpen > 0 ? 'todos' : 'checklist';
}

/**
 * The rows the closed view lists: everything open, plus whatever has been
 * listed since `shown` was created.
 *
 * A row ticked here stays where it is, struck through. Dropping it at once
 * would slide the next row under the pointer, and a second click on the same
 * spot would tick a step nobody meant to tick. `shown` lives as long as the
 * view of this patient and day, so the row is gone on the next visit.
 */
export function keepShown<T extends { id: string; done: boolean }>(
  rows: readonly T[],
  shown: Set<string>,
): T[] {
  for (const row of rows) {
    if (!row.done) shown.add(row.id);
  }
  return rows.filter((row) => shown.has(row.id));
}
