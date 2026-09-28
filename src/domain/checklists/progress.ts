import type { SavedChecklist } from '@/domain/types';

/**
 * Where you are in a reusable checklist.
 *
 * TICKS LIVE APART FROM THE LISTS (`profile.checklistDone.<listId>`), each
 * written as one atomic add or remove. Two faults came from keeping them
 * inside the list array:
 *  - every tick rewrote the whole array, so two quick ticks could undo each
 *    other (recurring pattern 5);
 *  - ticking a BUILT-IN list saved a full copy of it into the account, and
 *    that copy hid every later correction to the built-in version. That is
 *    the real reason behind the "checklist tersimpan berbeda dari versi
 *    terbaru" banner: nobody edited those lists, they ticked one box.
 *
 * `list.done` is still READ for lists ticked before this change, until the
 * first new tick writes the list's own entry.
 */
export type ChecklistTicks = Record<string, string[]>;

export function doneFor(list: SavedChecklist, ticks: ChecklistTicks | undefined): string[] {
  const own = ticks?.[list.id];
  const source = Array.isArray(own) ? own : list.done;
  // Only ticks for items that still exist: a step removed from a list must not
  // count towards its progress.
  const ids = new Set(list.items.map((item) => item.id));
  return source.filter((id) => ids.has(id));
}

export type ChecklistStatus = 'baru' | 'berjalan' | 'selesai';

export function statusOf(done: number, total: number): ChecklistStatus {
  if (total > 0 && done >= total) return 'selesai';
  return done > 0 ? 'berjalan' : 'baru';
}

/** The first step not yet ticked: "where am I". Null when everything is done. */
export function nextStep(list: SavedChecklist, done: readonly string[]): string | null {
  const ticked = new Set(done);
  return list.items.find((item) => !ticked.has(item.id))?.id ?? null;
}

/** Title, context and every step, for search. Lowercase. */
export function checklistHaystack(list: SavedChecklist): string {
  return [list.title, list.context ?? '', ...list.items.map((item) => item.label), ...(list.notes ?? [])]
    .join('\n')
    .toLowerCase();
}
