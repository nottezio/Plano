import { describe, expect, it } from 'vitest';

import {
  activeTodos,
  groupTodoViews,
  labelsToImport,
  removeTodo,
  setRepeat,
  todoHistory,
  todoViews,
  toggleTodo,
} from './patientTodos';
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

describe('doneOn on one-off items', () => {
  it('records the viewed day when ticked', () => {
    const change = toggleTodo(TODOS, undefined, TODAY, 'once');
    expect(change.todos?.find((todo) => todo.id === 'once')).toMatchObject({
      done: true,
      doneOn: TODAY,
    });
  });

  it('removes the field, rather than setting it undefined, when unticked', () => {
    const ticked: PatientTodo[] = [{ id: 'once', label: 'x', done: true, doneOn: YESTERDAY }];
    const next = toggleTodo(ticked, undefined, TODAY, 'once').todos?.[0];
    expect(next?.done).toBe(false);
    // Firestore rejects undefined values; the key must be gone.
    expect(next && 'doneOn' in next).toBe(false);
  });

  it('dates an item that is done when it stops repeating', () => {
    const ticks: TodoTicks = { [TODAY]: ['daily'] };
    const next = setRepeat(TODOS, ticks, TODAY, 'daily', false).todos?.find(
      (todo) => todo.id === 'daily',
    );
    expect(next).toMatchObject({ repeat: false, done: true, doneOn: TODAY });
  });
});

describe('todoHistory', () => {
  const todos: PatientTodo[] = [
    { id: 'daily', label: 'Update grup', done: false, repeat: true },
    { id: 'once', label: 'Konfirmasi koding', done: true, doneOn: YESTERDAY },
    { id: 'old', label: 'Ambil darah', done: true },
    { id: 'open', label: 'Belum', done: false },
  ];

  it('groups by day, newest first, in list order', () => {
    const ticks: TodoTicks = { [YESTERDAY]: ['daily'], [TODAY]: ['daily'] };
    const history = todoHistory(todos, ticks);
    expect(history.days.map((day) => day.date)).toEqual([TODAY, YESTERDAY]);
    expect(history.days[1]?.items.map((item) => item.id)).toEqual(['daily', 'once']);
  });

  it('lists a done one-off item without a date as undated, never guessed', () => {
    expect(todoHistory(todos, undefined).undated).toEqual([
      { id: 'old', label: 'Ambil darah', removed: false },
    ]);
  });

  it('leaves out open items and ticks on deleted items (`gone`)', () => {
    const history = todoHistory(todos, { [TODAY]: ['gone'] });
    expect(history.days).toEqual([
      {
        date: YESTERDAY,
        items: [{ id: 'once', label: 'Konfirmasi koding', repeat: false, removed: false }],
      },
    ]);
  });

  it('keeps past ticks of an item that has since become one-off', () => {
    const converted: PatientTodo[] = [{ id: 'daily', label: 'Update grup', done: false }];
    expect(todoHistory(converted, { [YESTERDAY]: ['daily'] }).days).toHaveLength(1);
  });

  it('does not list the same item twice on one day', () => {
    const both: PatientTodo[] = [{ id: 'x', label: 'X', done: true, doneOn: TODAY }];
    expect(todoHistory(both, { [TODAY]: ['x'] }).days[0]?.items).toHaveLength(1);
  });
});

describe('removeTodo — check, then delete to keep the list short', () => {
  it('keeps a checked one-off item, hidden, for the history', () => {
    const todos: PatientTodo[] = [{ id: 'x', label: 'Koding', done: true, doneOn: YESTERDAY }];
    const next = removeTodo(todos, undefined, TODAY, 'x');
    expect(next).toEqual([{ id: 'x', label: 'Koding', done: true, doneOn: YESTERDAY, removedOn: TODAY }]);
    expect(activeTodos(next)).toEqual([]);
    expect(todoHistory(next, undefined).days[0]?.items).toEqual([
      { id: 'x', label: 'Koding', repeat: false, removed: true },
    ]);
  });

  it('removes an item that was never checked, outright', () => {
    const todos: PatientTodo[] = [{ id: 'x', label: 'Belum', done: false }];
    expect(removeTodo(todos, undefined, TODAY, 'x')).toEqual([]);
  });

  it('keeps a repeating item ticked on an earlier day, even if not ticked today', () => {
    const todos: PatientTodo[] = [{ id: 'd', label: 'Update grup', done: false, repeat: true }];
    const ticks: TodoTicks = { [YESTERDAY]: ['d'], [TODAY]: [] };
    const next = removeTodo(todos, ticks, TODAY, 'd');
    expect(next[0]?.removedOn).toBe(TODAY);
    expect(todoHistory(next, ticks).days.map((day) => day.date)).toEqual([YESTERDAY]);
  });

  it('keeps an undated checked item and marks it deleted', () => {
    const todos: PatientTodo[] = [{ id: 'o', label: 'Lama', done: true }];
    const next = removeTodo(todos, undefined, TODAY, 'o');
    expect(todoHistory(next, undefined).undated).toEqual([
      { id: 'o', label: 'Lama', removed: true },
    ]);
  });

  it('hides deleted items from the list and its counts', () => {
    const todos: PatientTodo[] = [
      { id: 'a', label: 'A', done: true, removedOn: TODAY },
      { id: 'b', label: 'B', done: false },
    ];
    expect(todoViews(todos, undefined, TODAY).map((view) => view.id)).toEqual(['b']);
  });

  it('leaves the other items untouched', () => {
    const todos: PatientTodo[] = [
      { id: 'a', label: 'A', done: true },
      { id: 'b', label: 'B', done: false },
    ];
    expect(removeTodo(todos, undefined, TODAY, 'a')[1]).toBe(todos[1]);
  });
});

describe('labelsToImport', () => {
  it('skips steps already on the list', () => {
    const todos: PatientTodo[] = [{ id: 'a', label: 'EKG', done: false }];
    expect(labelsToImport(todos, ['EKG', 'Lab'])).toEqual(['Lab']);
  });

  it('brings back a step that was checked and deleted', () => {
    const todos: PatientTodo[] = [{ id: 'a', label: 'EKG', done: true, removedOn: YESTERDAY }];
    expect(labelsToImport(todos, ['EKG', 'Lab'])).toEqual(['EKG', 'Lab']);
  });
});

describe('groupTodoViews', () => {
  const view = (id: string, label: string, fromChecklist?: string) => ({
    id,
    label,
    repeat: false,
    done: false,
    doneYesterday: false,
    ...(fromChecklist ? { fromChecklist } : {}),
  });

  it('separates your own items from imported ones, one block per checklist', () => {
    const grouped = groupTodoViews(
      [view('a', 'Konfirmasi BTKV'), view('b', 'EKG', 'Follow-up harian'), view('c', 'Lab', 'Follow-up harian')],
      new Map(),
    );
    expect(grouped.own.map((v) => v.id)).toEqual(['a']);
    expect(grouped.imported).toEqual([
      { title: 'Follow-up harian', items: [grouped.imported[0]!.items[0]!, grouped.imported[0]!.items[1]!] },
    ]);
    expect(grouped.imported[0]?.items.map((v) => v.id)).toEqual(['b', 'c']);
  });

  it('recognises an item imported before the source was recorded, by its label', () => {
    const grouped = groupTodoViews([view('a', 'EKG')], new Map([['EKG', 'Follow-up harian']]));
    expect(grouped.own).toEqual([]);
    expect(grouped.imported[0]?.title).toBe('Follow-up harian');
  });

  it('keeps list order inside each group', () => {
    const grouped = groupTodoViews(
      [view('1', 'x', 'A'), view('2', 'mine'), view('3', 'y', 'A')],
      new Map(),
    );
    expect(grouped.imported[0]?.items.map((v) => v.id)).toEqual(['1', '3']);
  });
});
