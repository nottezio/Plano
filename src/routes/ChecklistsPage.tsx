import { useMemo, useState } from 'react';

import { AppShell } from '@/components/common/AppShell';
import { updateChecklists } from '@/data/repositories/settings.repo';
import { SEED_CHECKLISTS } from '@/domain/checklists/seeds';
import { useSession } from '@/store/useSession';
import type { SavedChecklist } from '@/domain/types';

/**
 * Reusable checklists — the procedures that get forgotten.
 *
 * Distinct from the daily patient checklist, which follows one patient through
 * one day and resets at midnight. These follow a *situation*: a transfer from
 * CVCU, a poli patient booked for PCI, a discharge. You work through one, reset
 * it, and use it again for the next patient in the same situation.
 *
 * Ticks are therefore state, not history: "where am I in this right now". They
 * are not kept per patient, because storing them that way would imply they were
 * a record of what was done, and they are not — nothing here is evidence.
 */
export default function ChecklistsPage(): JSX.Element {
  const uid = useSession((state) => state.user?.uid ?? null);
  const profile = useSession((state) => state.profile);
  const [openId, setOpenId] = useState<string | null>(null);

  /**
   * Seeds appear until they are saved, so the page is useful on first open
   * without writing anything to the database on someone's behalf.
   */
  const lists = useMemo<SavedChecklist[]>(() => {
    const saved = profile?.checklists ?? [];
    const savedIds = new Set(saved.map((list) => list.id));

    const unsaved = SEED_CHECKLISTS.filter((seed) => !savedIds.has(seed.id)).map((seed) => ({
      id: seed.id,
      title: seed.title,
      ...(seed.context ? { context: seed.context } : {}),
      ...(seed.notes ? { notes: seed.notes } : {}),
      items: seed.items.map((item) => ({ ...item })),
      done: [],
    }));

    return [...saved, ...unsaved];
  }, [profile?.checklists]);

  const persist = (next: SavedChecklist[]): void => {
    if (!uid) return;
    void updateChecklists(uid, next).catch((error: unknown) =>
      console.error('[checklists] write rejected', error),
    );
  };

  const toggle = (listId: string, itemId: string): void => {
    persist(
      lists.map((list) =>
        list.id === listId
          ? {
              ...list,
              done: list.done.includes(itemId)
                ? list.done.filter((id) => id !== itemId)
                : [...list.done, itemId],
            }
          : list,
      ),
    );
  };

  const reset = (listId: string): void => {
    persist(lists.map((list) => (list.id === listId ? { ...list, done: [] } : list)));
  };

  return (
    <AppShell title="Checklist">
      <div className="mx-auto w-full max-w-2xl space-y-3 px-4 py-4">
        {lists.map((list) => {
          const open = openId === list.id;
          const done = list.done.length;
          const total = list.items.length;

          return (
            <section key={list.id} className="rounded-xl border border-border bg-surface">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : list.id)}
                aria-expanded={open}
                className="flex min-h-tap w-full items-center gap-3 p-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{list.title}</span>
                  {list.context ? (
                    <span className="mt-0.5 block text-[11px] text-fg-faint">{list.context}</span>
                  ) : null}
                </span>
                <span
                  className={[
                    'shrink-0 rounded-full px-2 py-0.5 text-[11px]',
                    done === total && total > 0
                      ? 'bg-token text-token-fg'
                      : 'border border-border text-fg-muted',
                  ].join(' ')}
                  data-color-token={done === total && total > 0 ? 'done' : undefined}
                >
                  {done}/{total}
                </span>
                <span aria-hidden="true" className="shrink-0 text-fg-faint">
                  {open ? '−' : '+'}
                </span>
              </button>

              {open ? (
                <div className="border-t border-border p-3">
                  <ul className="space-y-1">
                    {list.items.map((item) => {
                      const checked = list.done.includes(item.id);
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => toggle(list.id, item.id)}
                            aria-pressed={checked}
                            className="flex min-h-tap w-full items-start gap-2 rounded-lg px-1 text-left"
                          >
                            <span
                              aria-hidden="true"
                              className={[
                                'mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]',
                                checked
                                  ? 'border-accent bg-accent text-white'
                                  : 'border-border-strong',
                              ].join(' ')}
                            >
                              {checked ? '✓' : ''}
                            </span>
                            <span
                              className={[
                                'min-w-0 flex-1 py-1 text-xs leading-relaxed',
                                checked ? 'text-fg-faint line-through' : 'text-fg',
                              ].join(' ')}
                            >
                              {item.label}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  {list.notes && list.notes.length > 0 ? (
                    <div className="mt-3 rounded-lg border border-border bg-bg-subtle p-2">
                      <p className="text-[11px] font-semibold text-fg-muted">Catatan</p>
                      <ul className="mt-1 space-y-1">
                        {list.notes.map((note) => (
                          <li key={note} className="text-[11px] leading-relaxed text-fg-muted">
                            • {note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => reset(list.id)}
                    disabled={done === 0}
                    className="mt-2 min-h-tap text-xs text-accent underline disabled:text-fg-faint disabled:no-underline"
                  >
                    Reset untuk pasien berikutnya
                  </button>
                </div>
              ) : null}
            </section>
          );
        })}

        <p className="px-1 text-[11px] text-fg-faint">
          Centang di sini tidak tersimpan per pasien — ini penanda posisi Anda dalam satu
          prosedur, bukan catatan bahwa sesuatu sudah dikerjakan.
        </p>
      </div>
    </AppShell>
  );
}
