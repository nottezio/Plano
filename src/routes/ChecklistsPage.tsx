import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { AppShell } from '@/components/common/AppShell';
import { Highlight } from '@/components/common/Highlight';
import { IconBack, IconClose, IconSearch } from '@/components/common/Icons';
import {
  resetChecklistTicks,
  tickChecklistStep,
  updateChecklists,
} from '@/data/repositories/settings.repo';
import {
  checklistHaystack,
  doneFor,
  nextStep,
  statusOf,
  type ChecklistStatus,
} from '@/domain/checklists/progress';
import { SEED_CHECKLISTS } from '@/domain/checklists/seeds';
import { searchTokens } from '@/domain/archiveSearch';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useSession } from '@/store/useSession';
import type { SavedChecklist } from '@/domain/types';

/**
 * Reusable checklists — the procedures that get forgotten.
 *
 * Distinct from the daily patient checklist, which follows one patient through
 * one day. These follow a SITUATION (a transfer from CVCU, a poli patient
 * booked for PCI, a discharge): you work through one, reset it, and use it
 * again for the next patient in the same situation. Ticks are "where am I in
 * this right now", not a record of what was done.
 *
 * REDESIGNED from an accordion of cards (one open at a time, no search, no
 * sign of where you were in a list):
 *  - laptop: the list and the open checklist side by side; phone: the list,
 *    then the checklist full screen (`?c=` in the URL, so back closes it);
 *  - search across titles AND steps;
 *  - lists in progress first, with a progress bar on every row;
 *  - the next unticked step is marked, which is the whole question when you
 *    come back to a procedure halfway through.
 *
 * Ticks are stored per list, one atomic change each (`progress.ts`).
 */

const seedToList = (seed: (typeof SEED_CHECKLISTS)[number]): SavedChecklist => ({
  id: seed.id,
  title: seed.title,
  ...(seed.context ? { context: seed.context } : {}),
  ...(seed.notes ? { notes: seed.notes } : {}),
  items: seed.items.map((item) => ({ ...item })),
  done: [],
});

export default function ChecklistsPage(): JSX.Element {
  const uid = useSession((state) => state.user?.uid ?? null);
  const profile = useSession((state) => state.profile);
  const wide = useMediaQuery('(min-width: 1024px)');
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const tokens = useMemo(() => searchTokens(query), [query]);

  /**
   * Built-in lists are shown from the seed unless a saved copy exists. With
   * ticks stored apart, a saved copy now only exists for lists ticked before
   * this change; new ticks never create one.
   */
  const lists = useMemo<SavedChecklist[]>(() => {
    const saved = profile?.checklists ?? [];
    const savedIds = new Set(saved.map((list) => list.id));
    return [...saved, ...SEED_CHECKLISTS.filter((seed) => !savedIds.has(seed.id)).map(seedToList)];
  }, [profile?.checklists]);

  const ticks = profile?.checklistDone;

  /** Saved copies that differ from the current built-in version. */
  const outdated = useMemo(() => {
    const saved = profile?.checklists ?? [];
    return SEED_CHECKLISTS.filter((seed) => {
      const mine = saved.find((list) => list.id === seed.id);
      if (!mine) return false;
      const a = seed.items.map((item) => item.label).join('|');
      const b = mine.items.map((item) => item.label).join('|');
      return a !== b || seed.title !== mine.title;
    });
  }, [profile?.checklists]);

  /**
   * Replace outdated saved copies with the current built-in version. Their
   * ticks are reset: a position in a list whose steps changed is not a
   * position in the new one.
   */
  const refreshSeeds = (): void => {
    if (!uid) return;
    const saved = profile?.checklists ?? [];
    const outdatedIds = new Set(outdated.map((seed) => seed.id));
    void updateChecklists(
      uid,
      saved.map((list) => {
        const seed = outdated.find((candidate) => candidate.id === list.id);
        return seed ? seedToList(seed) : list;
      }),
    ).catch((error: unknown) => console.error('[checklists] refresh rejected', error));
    for (const id of outdatedIds) {
      void resetChecklistTicks(uid, id).catch((error: unknown) =>
        console.error('[checklists] reset rejected', error),
      );
    }
  };

  const rows = useMemo(
    () =>
      lists
        .map((list) => {
          const done = doneFor(list, ticks);
          return { list, done, status: statusOf(done.length, list.items.length) };
        })
        .filter(({ list }) => tokens.every((token) => checklistHaystack(list).includes(token))),
    [lists, ticks, tokens],
  );
  const running = rows.filter((row) => row.status === 'berjalan');
  const others = rows.filter((row) => row.status !== 'berjalan');

  const openId = params.get('c');
  const open = rows.find((row) => row.list.id === openId) ?? (wide ? (running[0] ?? rows[0]) : undefined);

  const openList = (id: string): void => {
    const next = new URLSearchParams(params);
    next.set('c', id);
    setParams(next, wide ? { replace: true } : { state: { fromList: true } });
  };
  const closeList = (): void => {
    if ((location.state as { fromList?: boolean } | null)?.fromList) {
      navigate(-1);
      return;
    }
    const next = new URLSearchParams(params);
    next.delete('c');
    setParams(next, { replace: true });
  };

  const toggle = (list: SavedChecklist, itemId: string, checked: boolean): void => {
    if (!uid) return;
    const own = ticks?.[list.id];
    void tickChecklistStep(uid, list.id, itemId, checked, Array.isArray(own) ? null : list.done).catch(
      (error: unknown) => console.error('[checklists] tick rejected', error),
    );
  };

  const reset = (listId: string): void => {
    if (!uid) return;
    void resetChecklistTicks(uid, listId).catch((error: unknown) =>
      console.error('[checklists] reset rejected', error),
    );
  };

  const listPane = (
    <div className="flex flex-col gap-3 p-3">
      <label className="flex min-h-tap items-center gap-2 rounded-xl border border-border bg-surface px-3 focus-within:border-accent">
        <IconSearch width="16" height="16" className="shrink-0 text-fg-faint" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Cari checklist"
          placeholder="Cari judul atau langkah…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        {query ? (
          <button
            type="button"
            aria-label="Hapus pencarian"
            onClick={() => setQuery('')}
            className="-mr-2 flex min-h-tap min-w-tap items-center justify-center text-fg-faint"
          >
            <IconClose width="16" height="16" />
          </button>
        ) : null}
      </label>

      {outdated.length > 0 ? (
        <div className="rounded-xl border border-accent bg-bg-subtle p-3">
          <p className="text-xs text-fg">
            {outdated.length} checklist tersimpan berbeda dari versi terbaru di aplikasi.
          </p>
          <button
            type="button"
            onClick={refreshSeeds}
            className="mt-2 min-h-tap rounded-lg border border-accent px-3 text-xs font-medium text-accent"
          >
            Perbarui ke versi terbaru
          </button>
          <p className="mt-1 text-[11px] text-fg-faint">Centang yang sedang berjalan direset, karena langkahnya berubah.</p>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-fg-muted">Tidak ada checklist yang cocok.</p>
      ) : null}
      {running.length > 0 ? (
        <Group
          title="Sedang berjalan"
          rows={running}
          activeId={wide ? open?.list.id ?? null : null}
          tokens={tokens}
          onOpen={openList}
        />
      ) : null}
      {others.length > 0 ? (
        <Group
          title={running.length > 0 ? 'Checklist lain' : 'Semua checklist'}
          rows={others}
          activeId={wide ? open?.list.id ?? null : null}
          tokens={tokens}
          onOpen={openList}
        />
      ) : null}
      <p className="px-1 text-[11px] text-fg-faint">
        Centang di sini tidak tersimpan per pasien: ini penanda posisi Anda dalam satu prosedur,
        bukan catatan bahwa sesuatu sudah dikerjakan.
      </p>
    </div>
  );

  const detail = open ? (
    <ChecklistDetail
      key={open.list.id}
      list={open.list}
      done={open.done}
      tokens={tokens}
      onBack={wide ? undefined : closeList}
      onToggle={(itemId, checked) => toggle(open.list, itemId, checked)}
      onReset={() => reset(open.list.id)}
    />
  ) : (
    <p className="p-8 text-center text-sm text-fg-faint">Pilih checklist.</p>
  );

  return (
    <AppShell title="Checklist">
      {wide ? (
        <div className="flex h-full min-h-0">
          <aside className="w-[22rem] shrink-0 overflow-y-auto border-r border-border">{listPane}</aside>
          <section className="min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl">{detail}</div>
          </section>
        </div>
      ) : open ? (
        detail
      ) : (
        <div className="mx-auto max-w-2xl">{listPane}</div>
      )}
    </AppShell>
  );
}

interface Row {
  list: SavedChecklist;
  done: string[];
  status: ChecklistStatus;
}

function Group({
  title,
  rows,
  activeId,
  tokens,
  onOpen,
}: {
  title: string;
  rows: readonly Row[];
  activeId: string | null;
  tokens: readonly string[];
  onOpen: (id: string) => void;
}): JSX.Element {
  return (
    <section>
      <h2 className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-fg-faint">
        {title} <span className="font-normal">{rows.length}</span>
      </h2>
      <ul className="space-y-1">
        {rows.map(({ list, done, status }) => {
          const total = list.items.length;
          const active = list.id === activeId;
          return (
            <li key={list.id}>
              <button
                type="button"
                onClick={() => onOpen(list.id)}
                aria-current={active ? 'true' : undefined}
                className={[
                  'block min-h-tap w-full rounded-xl border px-3 py-2.5 text-left transition-colors',
                  active ? 'border-accent bg-bg-subtle' : 'border-border bg-surface hover:bg-bg-subtle',
                ].join(' ')}
              >
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 text-sm font-semibold">
                    <Highlight text={list.title} tokens={tokens} />
                  </span>
                  <span
                    className={[
                      'shrink-0 text-[11px] font-semibold',
                      status === 'selesai' ? 'text-accent' : 'text-fg-muted',
                    ].join(' ')}
                  >
                    {status === 'selesai' ? 'Selesai ✓' : `${done.length}/${total}`}
                  </span>
                </span>
                {list.context ? (
                  <span className="mt-0.5 block truncate text-[11px] text-fg-muted">{list.context}</span>
                ) : null}
                <ProgressBar done={done.length} total={total} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ProgressBar({ done, total }: { done: number; total: number }): JSX.Element {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <span aria-hidden="true" className="mt-2 block h-1 overflow-hidden rounded-full bg-bg-subtle">
      <span className="block h-full rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} />
    </span>
  );
}

function ChecklistDetail({
  list,
  done,
  tokens,
  onBack,
  onToggle,
  onReset,
}: {
  list: SavedChecklist;
  done: readonly string[];
  tokens: readonly string[];
  onBack?: (() => void) | undefined;
  onToggle: (itemId: string, checked: boolean) => void;
  onReset: () => void;
}): JSX.Element {
  const [confirmReset, setConfirmReset] = useState(false);
  const ticked = new Set(done);
  const next = nextStep(list, done);
  const total = list.items.length;
  const finished = total > 0 && ticked.size >= total;

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      <div className="flex items-start gap-1">
        {onBack ? (
          <button
            type="button"
            aria-label="Kembali ke daftar"
            onClick={onBack}
            className="-ml-1 flex min-h-tap min-w-tap shrink-0 items-center justify-center rounded-lg text-fg-muted"
          >
            <IconBack />
          </button>
        ) : null}
        <div className="min-w-0 flex-1 pt-2">
          <h2 className="text-lg font-semibold leading-snug">{list.title}</h2>
          {list.context ? <p className="mt-0.5 text-xs text-fg-muted">{list.context}</p> : null}
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between text-xs">
          <span className={finished ? 'font-semibold text-accent' : 'text-fg-muted'}>
            {finished ? 'Semua langkah selesai ✓' : `${ticked.size} dari ${total} langkah`}
          </span>
          {ticked.size > 0 ? (
            confirmReset ? (
              <span className="flex items-center gap-2">
                <span className="text-fg-muted">Reset untuk pasien berikutnya?</span>
                <button type="button" onClick={() => setConfirmReset(false)} className="min-h-tap px-1 text-fg-muted">
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onReset();
                    setConfirmReset(false);
                  }}
                  className="min-h-tap px-1 font-semibold text-accent"
                >
                  Reset
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmReset(true)} className="min-h-tap px-1 text-accent">
                Reset
              </button>
            )
          ) : null}
        </div>
        <ProgressBar done={ticked.size} total={total} />
      </div>

      <ol className="space-y-1">
        {list.items.map((item, index) => {
          const checked = ticked.has(item.id);
          const isNext = item.id === next;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onToggle(item.id, !checked)}
                aria-pressed={checked}
                className={[
                  'flex min-h-tap w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                  isNext
                    ? 'border-accent bg-bg-subtle'
                    : checked
                      ? 'border-transparent'
                      : 'border-border hover:bg-bg-subtle',
                ].join(' ')}
              >
                <span
                  aria-hidden="true"
                  className={[
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-xs font-bold',
                    checked ? 'border-accent bg-accent text-white' : 'border-fg-faint',
                  ].join(' ')}
                >
                  {checked ? '✓' : ''}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={[
                      'block text-sm leading-relaxed',
                      checked ? 'text-fg-faint line-through' : 'text-fg',
                    ].join(' ')}
                  >
                    <span className="mr-1.5 text-xs text-fg-faint">{index + 1}.</span>
                    <Highlight text={item.label} tokens={tokens} />
                  </span>
                  {isNext ? (
                    <span className="mt-0.5 block text-[11px] font-semibold text-accent">Langkah berikutnya</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {list.notes && list.notes.length > 0 ? (
        <div className="rounded-xl border border-border bg-bg-subtle p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">Catatan</p>
          <ul className="mt-1 space-y-1">
            {list.notes.map((note) => (
              <li key={note} className="text-xs leading-relaxed text-fg-muted">
                • {note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
