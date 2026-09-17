import { useMemo, useState } from 'react';
import { nanoid } from 'nanoid';

import { setTodoTicks, updatePatient } from '@/data/repositories/patients.repo';
import { SEED_CHECKLISTS } from '@/domain/checklists/seeds';
import { useSession } from '@/store/useSession';
import {
  labelsToImport,
  removeTodo,
  setRepeat,
  todoHistory,
  todoViews,
  toggleTodo,
} from '@/domain/patientTodos';
import { formatShortDate } from '@/domain/clinicalDate';
import type { ClinicalDate, Patient } from '@/domain/types';

/**
 * A checklist belonging to one patient.
 *
 * Three kinds of checklist now exist and they are deliberately not the same
 * thing: the daily one is identical for every patient and resets at midnight;
 * the Checklist tab holds reusable procedures; this is what to remember for
 * THIS admission, and it persists across days because that is the whole reason
 * to write it down.
 *
 * A procedure can be copied in from the tab. Copied, not linked — the ticks
 * here are about this patient, and linking would mean ticking a step for one
 * patient marked it done for the next.
 */
export function PatientTodos({
  patient,
  /**
   * The day being viewed, not `today`.
   *
   * Opening yesterday must show yesterday's ticks. Reading the wall clock here
   * would show today's answers under yesterday's note and invite ticking a step
   * against the wrong day — the same class of mistake as the toolbar sheets
   * that wrote to the day's SOAP while a jaga note was open.
   */
  date,
  compact = false,
}: {
  patient: Patient;
  date: ClinicalDate;
  /**
   * Drop the section's own heading, for a caller that already names it.
   *
   * The peek window puts this inside a strip labelled "Custom Checklist", and
   * two headings one line apart reading the same words is how a small window
   * runs out of room for the thing it is showing.
   */
  compact?: boolean;
}): JSX.Element {
  const [draft, setDraft] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const todos = patient.todos ?? [];
  const views = todoViews(todos, patient.todoTicks, date);
  const doneCount = views.filter((view) => view.done).length;

  const writeTicks = (ids: string[]): void => {
    void setTodoTicks(patient.id, date, ids).catch((error: unknown) =>
      console.error('[todos] tick write rejected', error),
    );
  };

  /**
   * Import from the user's OWN checklists, falling back to the seeds.
   *
   * This read `SEED_CHECKLISTS` directly, which is why importing "did not work
   * sometimes": a list you had edited imported its original wording, and a list
   * you created yourself did not appear at all — there was no seed to find. The
   * tab is the source of truth for what a checklist contains; this now reads
   * the same thing.
   */
  const saved = useSession((state) => state.profile?.checklists ?? []);
  const available = useMemo(() => {
    const savedIds = new Set(saved.map((list) => list.id));
    return [
      ...saved.map((list) => ({ id: list.id, title: list.title, items: list.items })),
      ...SEED_CHECKLISTS.filter((seed) => !savedIds.has(seed.id)).map((seed) => ({
        id: seed.id,
        title: seed.title,
        items: seed.items,
      })),
    ];
  }, [saved]);

  const save = (next: Patient['todos']): void => {
    void updatePatient(patient.id, { todos: next }).catch((error: unknown) =>
      console.error('[todos] write rejected', error),
    );
  };

  const add = (): void => {
    if (!draft.trim()) return;
    save([...todos, { id: nanoid(6), label: draft.trim(), done: false }]);
    setDraft('');
  };

  const importList = (id: string): void => {
    const seed = available.find((list) => list.id === id);
    if (!seed) return;

    // Importing twice does not double the list; see `labelsToImport` for
    // why a deleted step still comes back.
    const added = labelsToImport(
      todos,
      seed.items.map((item) => item.label),
    ).map((label) => ({ id: nanoid(6), label, done: false }));

    save([...todos, ...added]);
    setImportOpen(false);
  };

  return (
    <section
      className={
        compact ? 'px-0 py-0' : 'border-b border-border px-4 py-2 xl:border-0 xl:px-0'
      }
    >
      <div className="flex items-center gap-2">
        {compact ? (
          <span className="flex-1" />
        ) : (
          <h3 className="flex-1 text-xs font-semibold text-fg-muted">
            Custom Checklist
            {views.length > 0 ? (
              <span className="ml-1 font-normal text-fg-faint">
                {doneCount}/{views.length}
              </span>
            ) : null}
          </h3>
        )}
        <button
          type="button"
          onClick={() => setImportOpen((open) => !open)}
          className="min-h-tap text-[11px] text-accent underline"
        >
          Ambil dari checklist harian
        </button>
        <button
          type="button"
          onClick={() => setHistoryOpen((open) => !open)}
          aria-expanded={historyOpen}
          className="min-h-tap shrink-0 text-[11px] text-accent underline"
        >
          {historyOpen ? 'Tutup riwayat' : 'Riwayat'}
        </button>
      </div>

      {historyOpen ? <TodoHistoryList history={todoHistory(todos, patient.todoTicks)} /> : null}

      {importOpen ? (
        <div className="mt-1 space-y-1">
          {available.map((list) => (
            <button
              key={list.id}
              type="button"
              onClick={() => importList(list.id)}
              className="w-full rounded-lg border border-border px-2 py-1.5 text-left text-[11px]"
            >
              {list.title}
            </button>
          ))}
        </div>
      ) : null}

      {views.length > 0 ? (
        <ul className="mt-1.5 space-y-1">
          {views.map((todo) => (
            <li key={todo.id} className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => {
                  const change = toggleTodo(todos, patient.todoTicks, date, todo.id);
                  if (change.todos) save(change.todos);
                  if (change.ticks) writeTicks(change.ticks);
                }}
                aria-pressed={todo.done}
                className="flex min-h-tap flex-1 items-start gap-2 text-left"
              >
                <span
                  aria-hidden="true"
                  className={[
                    'mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]',
                    todo.done ? 'border-accent bg-accent text-white' : 'border-border-strong',
                  ].join(' ')}
                >
                  {todo.done ? '✓' : ''}
                </span>
                <span
                  className={[
                    'min-w-0 flex-1 py-1 text-xs leading-snug',
                    todo.done ? 'text-fg-faint line-through' : 'text-fg',
                  ].join(' ')}
                >
                  {todo.label}
                  {/*
                    What you did yesterday, on the item rather than in a
                    separate log. Only when it is NOT done today — once ticked,
                    the tick says everything and the reminder is noise.
                  */}
                  {todo.doneYesterday ? (
                    <span className="ml-1.5 whitespace-nowrap text-[10px] text-fg-faint">
                      sudah kemarin
                    </span>
                  ) : null}
                </span>
              </button>
              {/*
                A toggle, not a second list. Shown always rather than on hover:
                a control that appears only when pointed at is a control nobody
                on a ward tablet finds.
              */}
              <button
                type="button"
                aria-label={todo.repeat ? 'Jadikan sekali saja' : 'Ulangi tiap hari'}
                aria-pressed={todo.repeat ?? false}
                title={todo.repeat ? 'Langkah harian' : 'Sekali saja'}
                onClick={() => {
                  const change = setRepeat(
                    todos,
                    patient.todoTicks,
                    date,
                    todo.id,
                    !todo.repeat,
                  );
                  if (change.todos) save(change.todos);
                  if (change.ticks) writeTicks(change.ticks);
                }}
                className={[
                  'flex min-h-tap min-w-[28px] shrink-0 items-start justify-center pt-1 text-xs leading-snug',
                  todo.repeat ? 'text-accent' : 'text-fg-faint opacity-40',
                ].join(' ')}
              >
                <span aria-hidden="true">⟳</span>
              </button>
              <button
                type="button"
                aria-label="Hapus"
                onClick={() => save(removeTodo(todos, patient.todoTicks, date, todo.id))}
                /*
                  Aligned to the label's FIRST LINE, not to the row's centre.
                  
                  `items-center` inside a 44 px tap target put the glyph 22 px
                  down, while the label — in a row that is `items-start` —
                  begins at 4 px. On a one-line item that reads as the × having
                  slipped below its own text, and on a wrapped one it drifts
                  further still. Matching the label's `py-1` and line height
                  puts the two on the same baseline whatever the item does.
                */
                className="flex min-h-tap min-w-[32px] shrink-0 items-start justify-center pt-1 text-xs leading-snug text-fg-faint"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-1.5 flex gap-1">
        <input
          type="text"
          value={draft}
          placeholder="Tambah…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') add();
          }}
          className="min-h-tap min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 text-xs outline-none"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="min-h-tap shrink-0 rounded-lg border border-accent px-3 text-xs font-medium text-accent disabled:opacity-40"
        >
          +
        </button>
      </div>
    </section>
  );
}

/**
 * What was ticked, grouped by day, newest first.
 *
 * Read-only and inline, under the header. A tick is changed on the list
 * itself for the day being viewed, and a history that could also tick would
 * be a second way to write to a day that is not on screen.
 */
function TodoHistoryList({
  history,
}: {
  history: ReturnType<typeof todoHistory>;
}): JSX.Element {
  if (history.days.length === 0 && history.undated.length === 0) {
    return <p className="mt-1 text-[11px] text-fg-faint">Belum ada yang dicentang.</p>;
  }

  return (
    <div className="mt-1 max-h-60 space-y-2 overflow-auto rounded-lg border border-border bg-bg-subtle px-2 py-1.5 text-[11px]">
      {history.days.map((day) => (
        <div key={day.date}>
          <p className="font-medium text-fg-muted">{formatShortDate(day.date)}</p>
          <ul className="mt-0.5 space-y-0.5">
            {day.items.map((item) => (
              <li key={item.id} className="flex gap-1.5">
                <span aria-hidden="true" className="text-accent">
                  ✓
                </span>
                <span className="min-w-0 break-words">{item.label}</span>
                {item.removed ? <RemovedMark /> : null}
                {item.repeat ? (
                  <span className="shrink-0 text-fg-faint" title="Langkah harian">
                    ⟳
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {history.undated.length > 0 ? (
        <div>
          {/* Ticked before the date was recorded. Said plainly, not guessed. */}
          <p className="font-medium text-fg-muted">Tanggal tidak tercatat</p>
          <ul className="mt-0.5 space-y-0.5">
            {history.undated.map((item) => (
              <li key={item.id} className="flex gap-1.5">
                <span aria-hidden="true" className="text-fg-faint">
                  ✓
                </span>
                <span className="min-w-0 break-words">{item.label}</span>
                {item.removed ? <RemovedMark /> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** A deleted item in the history: still listed, visibly no longer on the list. */
function RemovedMark(): JSX.Element {
  return <span className="shrink-0 text-fg-faint">(dihapus)</span>;
}
