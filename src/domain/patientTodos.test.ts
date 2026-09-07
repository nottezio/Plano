import { describe, expect, it } from 'vitest';

import { setRepeat, todoViews, toggleTodo } from './patientTodos';
import type { PatientTodo, TodoTicks } from './patientTodos';
import type { ClinicalDate } from './types';

const TODAY = '2026-09-08' as ClinicalDate;
const YESTERDAY = '2026-09-07' as ClinicalDate;

const TODOS: PatientTodo[] = [
  { id: 'daily', label: 'Update grup aritmia per hari', done: false, repeat: true },
  { id: 'once', label: 'Konfirmasi koding', done: false },
];

const done = (views: ReturnType<typeof todoViews>, id: string): boolean =>
  views.find((view) => view.id === id)!.done;

describe('todoViews', () => {
  it('reads a repeating item from the date, not from the item', () => {
    const ticks: TodoTicks = { [YESTERDAY]: ['daily'] };
    // Yesterday's tick does not make it done today. Nothing had to reset for
    // that to be true — a new day simply has no record yet.
    expect(done(todoViews(TODOS, ticks, TODAY), 'daily')).toBe(false);
    expect(done(todoViews(TODOS, ticks, YESTERDAY), 'daily')).toBe(true);
  });

  it('remembers that a repeating item was done yesterday', () => {
    const views = todoViews(TODOS, { [YESTERDAY]: ['daily'] }, TODAY);
    expect(views.find((view) => view.id === 'daily')?.doneYesterday).toBe(true);
  });

  it('stops saying "yesterday" once it is done today', () => {
    // Once ticked the tick says everything; the reminder is noise.
    const ticks: TodoTicks = { [YESTERDAY]: ['daily'], [TODAY]: ['daily'] };
    expect(todoViews(TODOS, ticks, TODAY).find((v) => v.id === 'daily')?.doneYesterday).toBe(
      false,
    );
  });

  it('keeps a one-off answer across days', () => {
    // "Done for this admission" is genuinely not a property of any one day.
    const todos: PatientTodo[] = [{ id: 'once', label: 'Konfirmasi koding', done: true }];
    expect(done(todoViews(todos, {}, TODAY), 'once')).toBe(true);
    expect(done(todoViews(todos, {}, YESTERDAY), 'once')).toBe(true);
  });

  it('adopts an existing tick when the date has no record yet', () => {
    /*
     * The migration, and it needs no write. Lists made before per-day ticks
     * existed carry today's answers on the item; dropping them would untick a
     * checklist somebody had already worked through this morning.
     */
    const todos: PatientTodo[] = [{ id: 'daily', label: 'X', done: true, repeat: true }];
    expect(done(todoViews(todos, {}, TODAY), 'daily')).toBe(true);
  });

  it('lets the date record win once it exists', () => {
    const todos: PatientTodo[] = [{ id: 'daily', label: 'X', done: true, repeat: true }];
    expect(done(todoViews(todos, { [TODAY]: [] }, TODAY), 'daily')).toBe(false);
  });

  it('does not read today as yesterday on the admission note', () => {
    // `addDays` returns the admission id unchanged — it has no previous day.
    const views = todoViews(TODOS, { IGD: ['daily'] }, 'IGD' as ClinicalDate);
    expect(views.find((view) => view.id === 'daily')?.doneYesterday).toBe(false);
  });
});

describe('toggleTodo', () => {
  it('writes a repeating tick to the date, never to the item', () => {
    const change = toggleTodo(TODOS, {}, TODAY, 'daily');
    expect(change.ticks).toEqual(['daily']);
    expect(change.todos).toBeUndefined();
  });

  it('writes a one-off to the item, never to the date', () => {
    const change = toggleTodo(TODOS, {}, TODAY, 'once');
    expect(change.todos?.find((todo) => todo.id === 'once')?.done).toBe(true);
    expect(change.ticks).toBeUndefined();
  });

  it('unticks without disturbing other items that day', () => {
    const ticks: TodoTicks = { [TODAY]: ['daily', 'other'] };
    expect(toggleTodo(TODOS, ticks, TODAY, 'daily').ticks).toEqual(['other']);
  });

  it('leaves other days alone', () => {
    const ticks: TodoTicks = { [YESTERDAY]: ['daily'] };
    const change = toggleTodo(TODOS, ticks, TODAY, 'daily');
    // The returned list is for TODAY only; yesterday is written by field path
    // and never sent, so it cannot be clobbered.
    expect(change.ticks).toEqual(['daily']);
  });

  it('does not double-tick', () => {
    const change = toggleTodo(TODOS, { [TODAY]: [] }, TODAY, 'daily');
    expect(toggleTodo(TODOS, { [TODAY]: change.ticks! }, TODAY, 'daily').ticks).toEqual([]);
  });
});

describe('setRepeat', () => {
  it('carries a ticked one-off across when it becomes repeating', () => {
    // Otherwise an item you had already ticked appears undone at the exact
    // moment you were tidying the list up.
    const todos: PatientTodo[] = [{ id: 'x', label: 'X', done: true }];
    const change = setRepeat(todos, {}, TODAY, 'x', true);
    expect(change.ticks).toEqual(['x']);
    expect(todoViews(change.todos!, { [TODAY]: change.ticks! }, TODAY)[0]!.done).toBe(true);
  });

  it('carries a ticked repeating item back onto the item', () => {
    const todos: PatientTodo[] = [{ id: 'x', label: 'X', done: false, repeat: true }];
    const change = setRepeat(todos, { [TODAY]: ['x'] }, TODAY, 'x', false);
    expect(change.todos?.[0]?.done).toBe(true);
    expect(change.ticks).toEqual([]);
  });

  it('leaves an unticked item unticked either way', () => {
    for (const repeat of [true, false]) {
      const todos: PatientTodo[] = [{ id: 'x', label: 'X', done: false, repeat: !repeat }];
      const change = setRepeat(todos, {}, TODAY, 'x', repeat);
      expect(todoViews(change.todos!, { [TODAY]: change.ticks! }, TODAY)[0]!.done).toBe(false);
    }
  });
});
