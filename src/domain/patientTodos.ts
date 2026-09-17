import { addDays } from './clinicalDate';
import type { ClinicalDate, Patient } from './types';

/**
 * Which patient-checklist items count as done today.
 *
 * WHY THE TICK MOVED OFF THE ITEM
 *
 * A patient checklist mixes two kinds of step. "Konfirmasi koding" is done once
 * for the admission. "Update grup aritmia per hari" comes round every morning,
 * and a tick on it means *today*, not *ever*.
 *
 * Both were stored the same way — a `done` boolean on the item — so the second
 * kind had no way to reset without destroying the first kind's answer. The
 * button that shipped before this unticked them on demand, and that was the
 * honest version of a bad model: it cleared the ticks and kept no record, so
 * "did I update the group yesterday?" became unanswerable the moment you
 * pressed it.
 *
 * The app already had the right shape for this and used it for the daily
 * checklist: reset is ARCHITECTURAL — the clinical date is the key, not a timer
 * that fires. Applying the same rule here, a repeating item's tick lives under
 * the date it was made:
 *
 *     todoTicks: { '2026-09-07': ['a1', 'b2'], '2026-09-08': ['a1'] }
 *
 * Nothing resets. A new day simply has no ticks yet, and every previous day is
 * still there to look at. One-off items keep `done` on the item, because
 * "done for this admission" is genuinely not a property of any one day.
 *
 * Stored on the patient rather than on each daily entry so that today AND
 * yesterday are readable from a document the page already subscribes to —
 * showing what you did yesterday must not cost a second fetch, or it will be
 * the first thing dropped when the ward wifi is slow.
 */
export type TodoTicks = Record<string, readonly string[]>;

export type PatientTodo = NonNullable<Patient['todos']>[number];

export interface TodoView {
  id: string;
  label: string;
  /** A step that comes round again, as opposed to a one-off. */
  repeat: boolean;
  done: boolean;
  /**
   * Ticked on the previous clinical day and not yet today.
   *
   * The point of keeping the log is answering "what did I already do
   * yesterday", so it is surfaced on the item rather than left in storage.
   */
  doneYesterday: boolean;
}

function ticksOn(ticks: TodoTicks | undefined, date: ClinicalDate): readonly string[] | undefined {
  return ticks?.[date];
}

export function todoViews(
  todos: readonly PatientTodo[],
  ticks: TodoTicks | undefined,
  date: ClinicalDate,
): TodoView[] {
  const today = ticksOn(ticks, date);
  const previous = addDays(date, -1);
  /**
   * `addDays` returns the admission-note id unchanged, because it has no
   * previous day. Comparing guards against reading today's ticks as
   * yesterday's and marking everything already done.
   */
  const yesterday = previous === date ? undefined : ticksOn(ticks, previous);

  return todos.map((todo) => {
    const repeat = todo.repeat ?? false;
    /**
     * A repeating item with NO tick record for this date falls back to its own
     * `done`.
     *
     * This is the migration, and it needs no write: checklists created before
     * per-day ticks existed carry today's answers on the item, and dropping
     * them would untick a list somebody had already worked through this
     * morning. The first toggle creates the date's record, which then takes
     * over permanently.
     */
    const done =
      repeat && today !== undefined ? today.includes(todo.id) : todo.done;

    return {
      id: todo.id,
      label: todo.label,
      repeat,
      done,
      doneYesterday: repeat && !done && (yesterday?.includes(todo.id) ?? false),
    };
  });
}

export interface TodoToggle {
  /** Present when the item is a one-off and its own flag changed. */
  todos?: PatientTodo[];
  /** Present when the item repeats — the full tick list for `date`. */
  ticks?: string[];
}

/**
 * Toggling writes to exactly one place.
 *
 * Returning which one rather than writing both keeps a single source of truth
 * per item: a repeat item whose `done` was also maintained would disagree with
 * its tick log the first time either was edited on another device, and there
 * would be no way to tell which was right.
 */
export function toggleTodo(
  todos: readonly PatientTodo[],
  ticks: TodoTicks | undefined,
  date: ClinicalDate,
  id: string,
): TodoToggle {
  const target = todos.find((todo) => todo.id === id);
  if (!target) return {};

  if (!target.repeat) {
    return {
      todos: todos.map((todo) => (todo.id === id ? withDone(todo, !todo.done, date) : todo)),
    };
  }

  const view = todoViews(todos, ticks, date).find((candidate) => candidate.id === id);
  const current = ticksOn(ticks, date) ?? (view?.done ? [id] : []);
  const next = view?.done
    ? current.filter((candidate) => candidate !== id)
    : [...new Set([...current, id])];

  return { ticks: next };
}

/**
 * Turning `repeat` on or off must not silently change what is ticked today.
 *
 * Switching a one-off to repeating moves where its answer is read from, and
 * without carrying the answer across, an item you had already ticked would
 * appear undone — which reads as the app forgetting, at the exact moment you
 * were tidying the list up.
 */
export function setRepeat(
  todos: readonly PatientTodo[],
  ticks: TodoTicks | undefined,
  date: ClinicalDate,
  id: string,
  repeat: boolean,
): TodoToggle {
  const view = todoViews(todos, ticks, date).find((candidate) => candidate.id === id);
  const done = view?.done ?? false;

  const nextTodos = todos.map((todo) => {
    if (todo.id !== id) return todo;
    // Becoming repeating: the day's tick below carries the history. Becoming
    // one-off: the item keeps its state, and records the day if it is done.
    return repeat ? { ...todo, repeat, done: false } : withDone({ ...todo, repeat }, done, date);
  });

  const current = ticksOn(ticks, date) ?? [];
  const nextTicks = repeat
    ? done
      ? [...new Set([...current, id])]
      : current.filter((candidate) => candidate !== id)
    : current.filter((candidate) => candidate !== id);

  return { todos: nextTodos, ticks: [...nextTicks] };
}

/**
 * A one-off item with its done state and the day it was done.
 *
 * `doneOn` is REMOVED on untick rather than set to `undefined`: Firestore
 * rejects `undefined` field values, and a stale date on an open item would put
 * it in the history for a day it was not done.
 */
function withDone(todo: PatientTodo, done: boolean, date: ClinicalDate): PatientTodo {
  if (done) return { ...todo, done, doneOn: date };
  const { doneOn: _dropped, ...rest } = todo;
  return { ...rest, done };
}

export interface TodoHistoryDay {
  date: ClinicalDate;
  items: Array<{ id: string; label: string; repeat: boolean }>;
}

export interface TodoHistory {
  /** Newest first. Only days with at least one ticked item. */
  days: TodoHistoryDay[];
  /** One-off items marked done before their date was recorded. */
  undated: Array<{ id: string; label: string }>;
}

/**
 * What was ticked, and on which day.
 *
 * Derived, never stored: repeating ticks already live under their date in
 * `todoTicks`, and one-off items carry `doneOn`. A stored log would be a
 * second record of the same facts that could disagree with the first.
 *
 * Ticks on an id that is no longer in the list are skipped. The label went
 * with the item, and a history entry that says only "an item" answers nothing.
 * Past ticks on an item that has since become one-off are kept, because they
 * record days it really was done.
 */
export function todoHistory(
  todos: readonly PatientTodo[],
  ticks: TodoTicks | undefined,
): TodoHistory {
  const byDate = new Map<ClinicalDate, Set<string>>();
  const mark = (date: ClinicalDate, id: string): void => {
    const set = byDate.get(date) ?? new Set<string>();
    set.add(id);
    byDate.set(date, set);
  };

  const known = new Set(todos.map((todo) => todo.id));
  for (const [date, ids] of Object.entries(ticks ?? {})) {
    for (const id of ids) if (known.has(id)) mark(date, id);
  }

  const undated: TodoHistory['undated'] = [];
  for (const todo of todos) {
    if (todo.repeat || !todo.done) continue;
    if (todo.doneOn) mark(todo.doneOn, todo.id);
    else undated.push({ id: todo.id, label: todo.label });
  }

  const days = [...byDate.entries()]
    .map(([date, ids]) => ({
      date,
      // List order, not tick order: the list is how the items are known.
      items: todos
        .filter((todo) => ids.has(todo.id))
        .map((todo) => ({ id: todo.id, label: todo.label, repeat: todo.repeat ?? false })),
    }))
    .filter((day) => day.items.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  return { days, undated };
}
