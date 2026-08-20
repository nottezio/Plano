import { useMemo, useState } from 'react';
import { nanoid } from 'nanoid';

import { updatePatient } from '@/data/repositories/patients.repo';
import { SEED_CHECKLISTS } from '@/domain/checklists/seeds';
import { useSession } from '@/store/useSession';
import type { Patient } from '@/domain/types';

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
export function PatientTodos({ patient }: { patient: Patient }): JSX.Element {
  const [draft, setDraft] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const todos = patient.todos ?? [];

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

    // Skip labels already present, so importing twice does not double the list.
    const existing = new Set(todos.map((todo) => todo.label));
    const added = seed.items
      .filter((item) => !existing.has(item.label))
      .map((item) => ({ id: nanoid(6), label: item.label, done: false }));

    save([...todos, ...added]);
    setImportOpen(false);
  };

  return (
    <section className="border-b border-border px-4 py-2 xl:border-0 xl:px-0">
      <div className="flex items-center gap-2">
        <h3 className="flex-1 text-xs font-semibold text-fg-muted">
          Checklist pasien
          {todos.length > 0 ? (
            <span className="ml-1 font-normal text-fg-faint">
              {todos.filter((todo) => todo.done).length}/{todos.length}
            </span>
          ) : null}
        </h3>
        <button
          type="button"
          onClick={() => setImportOpen((open) => !open)}
          className="min-h-tap text-[11px] text-accent underline"
        >
          Ambil dari checklist
        </button>
      </div>

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

      {todos.length > 0 ? (
        <ul className="mt-1.5 space-y-1">
          {todos.map((todo) => (
            <li key={todo.id} className="flex items-start gap-2">
              <button
                type="button"
                onClick={() =>
                  save(
                    todos.map((candidate) =>
                      candidate.id === todo.id
                        ? { ...candidate, done: !candidate.done }
                        : candidate,
                    ),
                  )
                }
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
                </span>
              </button>
              <button
                type="button"
                aria-label="Hapus"
                onClick={() => save(todos.filter((candidate) => candidate.id !== todo.id))}
                className="min-h-tap min-w-[28px] shrink-0 text-xs text-fg-faint"
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
