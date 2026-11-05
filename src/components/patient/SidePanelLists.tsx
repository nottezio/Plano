import { useEffect, useRef, useState, type ReactNode } from 'react';

import { ProgressStrip } from '@/components/board/ProgressStrip';
import { IconCheck, IconChevronRight } from '@/components/common/Icons';
import type { ChecklistProgress } from '@/domain/checklist';
import { firstOpenTab, keepShown, type SidePanelTab } from '@/domain/sidePanelLists';

/**
 * The two optional sidebars of the SOAP page ("Tab status" and "Rail warna").
 *
 * Unlike `SidePanel`, the closed view here ticks. It stays one behaviour in
 * one place because `tickTodo` and `useChecklist` are what the full lists use
 * too; only the row is drawn differently.
 */
export interface PanelRow {
  id: string;
  label: string;
  done: boolean;
  /** Colours the row's ring in the rail layout. */
  colorToken?: string;
  hint?: string;
}

export interface PanelList {
  title: string;
  tabLabel: string;
  rows: PanelRow[];
  progress: ChecklistProgress;
  onToggle: (id: string) => void;
  disabled?: boolean;
  /** The ticks have not arrived, so `rows` would read every step as open. */
  loading?: boolean;
  /**
   * The complete list with its own controls (adding, editing). Absent for a
   * list that is only ticks: opening it then shows every row, done ones
   * included, drawn exactly like the closed view.
   */
  full?: ReactNode;
}

export interface PanelContent {
  notes: { value: string; editor: ReactNode };
  checklist: PanelList;
  todos: PanelList;
  dates: {
    count: number;
    current: string;
    rail: ReactNode;
    /** Step to the earlier / later day; absent at either end of the rail. */
    prev?: () => void;
    next?: () => void;
  };
}

/**
 * The date list, opened at its newest day. The rail runs oldest to newest, so
 * a long admission opened at the top showed the first week and hid today.
 */
function DatesBody({ rail }: { rail: ReactNode }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  return (
    <div ref={ref} className="max-h-72 overflow-y-auto">
      {rail}
    </div>
  );
}

/*
  The panels are keyed by patient and day, so stepping to another day rebuilds
  them and a plain `useState(false)` closed the date list on every press. These
  hold just that one choice across the rebuild; they reset on reload.
*/
let datesOpenKept = false;
let tanggalTabKept = false;

function StepButton({
  dir,
  onStep,
}: {
  dir: 'prev' | 'next';
  onStep: (() => void) | undefined;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onStep}
      disabled={!onStep}
      aria-label={dir === 'prev' ? 'Tanggal sebelumnya' : 'Tanggal berikutnya'}
      className="flex min-h-tap min-w-tap items-center justify-center rounded-md text-fg-muted hover:bg-bg-subtle disabled:opacity-30 disabled:hover:bg-transparent [@media(pointer:fine)]:min-h-6 [@media(pointer:fine)]:min-w-6"
    >
      <IconChevronRight aria-hidden="true" className={`h-3 w-3 ${dir === 'prev' ? 'rotate-180' : ''}`} />
    </button>
  );
}

const openCount = (list: PanelList): number => list.rows.filter((row) => !row.done).length;
const isDone = (list: PanelList): boolean => list.progress.complete;

function useShownRows(list: PanelList): PanelRow[] {
  const shown = useRef(new Set<string>());
  return list.loading ? [] : keepShown(list.rows, shown.current);
}

function Row({
  row,
  coloured,
  disabled,
  onToggle,
}: {
  row: PanelRow;
  coloured: boolean;
  disabled: boolean;
  onToggle: (id: string) => void;
}): JSX.Element {
  const tint = coloured && row.colorToken ? row.colorToken : undefined;
  return (
    <button
      type="button"
      onClick={() => onToggle(row.id)}
      disabled={disabled}
      aria-pressed={row.done}
      className={[
        '-mx-1.5 flex min-h-tap w-[calc(100%+0.75rem)] items-start gap-2.5 rounded-md p-1.5 text-left text-[13px] leading-snug hover:bg-bg-subtle disabled:opacity-60 [@media(pointer:fine)]:min-h-8',
        row.done ? 'text-fg-faint' : 'text-fg',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        data-color-token={tint}
        className={[
          'mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px]',
          tint
            ? row.done
              ? 'border-token-accent bg-token-accent text-surface'
              : 'border-token-accent'
            : row.done
              ? 'border-accent bg-accent text-on-accent'
              : 'border-border-strong',
        ].join(' ')}
      >
        {row.done ? <IconCheck className="h-2.5 w-2.5" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className={row.done ? 'line-through' : undefined}>{row.label}</span>
        {row.hint ? (
          <span className="ml-1.5 whitespace-nowrap text-[11px] text-fg-faint">{row.hint}</span>
        ) : null}
      </span>
    </button>
  );
}

function Rows({
  list,
  coloured,
  all = false,
}: {
  list: PanelList;
  coloured: boolean;
  /** Every row, done ones too, instead of the open steps. */
  all?: boolean;
}): JSX.Element | null {
  const shown = useShownRows(list);
  const rows = all ? (list.loading ? [] : list.rows) : shown;
  if (rows.length === 0) return null;
  return (
    <div>
      {rows.map((row) => (
        <Row
          key={row.id}
          row={row}
          coloured={coloured}
          disabled={list.disabled ?? false}
          onToggle={list.onToggle}
        />
      ))}
    </div>
  );
}

function Count({ list }: { list: PanelList }): JSX.Element {
  return (
    <span
      className={[
        'flex shrink-0 items-center gap-1 font-medium tabular-nums',
        isDone(list) ? 'text-accent' : 'text-fg-muted',
      ].join(' ')}
    >
      {isDone(list) ? <IconCheck aria-hidden="true" className="h-3 w-3" /> : null}
      {list.progress.doneCount}/{list.progress.total}
    </span>
  );
}

/* ---- Tab status ---- */

function TabList({ list }: { list: PanelList }): JSX.Element {
  const [full, setFull] = useState(false);
  // Nothing written yet: the full list is the only place to add the first step.
  if (list.progress.total === 0) return <>{list.full}</>;
  return full ? (
    <>
      <button
        type="button"
        onClick={() => setFull(false)}
        className="flex min-h-tap items-center gap-1.5 self-start text-xs text-fg-muted [@media(pointer:fine)]:min-h-8"
      >
        <IconChevronRight aria-hidden="true" className="h-3 w-3 rotate-90" />
        Tutup daftar lengkap
      </button>
      {list.full ?? <Rows list={list} coloured={false} all />}
    </>
  ) : (
    <>
      {isDone(list) ? (
        <p className="flex items-center gap-1.5 py-1 text-[13px] font-medium text-accent">
          <IconCheck aria-hidden="true" className="h-3.5 w-3.5" /> Semua selesai
        </p>
      ) : null}
      <Rows list={list} coloured={false} />
      <button
        type="button"
        onClick={() => setFull(true)}
        className="mt-auto flex min-h-tap items-center gap-1.5 self-start pt-1 text-xs text-fg-muted [@media(pointer:fine)]:min-h-8"
      >
        Daftar lengkap · {list.progress.doneCount} selesai
        <IconChevronRight aria-hidden="true" className="h-3 w-3" />
      </button>
    </>
  );
}

/**
 * One row of tabs, one body open, as in the Peek Window: stacked sections sum,
 * a tab row costs one row whatever it holds. Key it by patient and day so the
 * tab and the kept rows start over with the view.
 */
export function TabPanels({ content }: { content: PanelContent }): JSX.Element {
  const { notes, checklist, todos, dates } = content;
  const [picked, setPickedState] = useState<SidePanelTab | null>(tanggalTabKept ? 'tanggal' : null);
  const setPicked = (id: SidePanelTab): void => {
    tanggalTabKept = id === 'tanggal';
    setPickedState(id);
  };
  // Fixed the first time the lists have loaded, so ticking the last open step
  // does not throw the body over to another tab.
  const auto = useRef<SidePanelTab | null>(null);
  if (auto.current === null && !checklist.loading && checklist.progress.total + todos.progress.total > 0) {
    auto.current = firstOpenTab(openCount(checklist), openCount(todos));
  }
  const tab = picked ?? auto.current ?? 'checklist';

  const tabButton = (id: SidePanelTab, label: string, value: string, done = false): JSX.Element => (
    <button
      type="button"
      onClick={() => setPicked(id)}
      aria-pressed={tab === id}
      className={[
        'flex min-h-tap min-w-0 flex-col items-start justify-center gap-px rounded-lg border px-1.5 py-1.5 text-left text-[11px] leading-tight text-fg-muted',
        tab === id ? 'border-border-strong bg-surface' : 'border-transparent hover:bg-surface',
      ].join(' ')}
    >
      <span className="max-w-full truncate">{label}</span>
      <span
        className={[
          'flex items-center gap-0.5 whitespace-nowrap text-sm font-semibold tabular-nums',
          done ? 'text-accent' : 'text-fg',
        ].join(' ')}
      >
        {done ? <IconCheck aria-hidden="true" className="h-3 w-3" /> : null}
        {value}
      </span>
    </button>
  );

  const listTab = (id: SidePanelTab, list: PanelList): JSX.Element =>
    tabButton(id, list.tabLabel, `${list.progress.doneCount}/${list.progress.total}`, isDone(list));

  return (
    <div className="flex shrink-0 flex-col gap-3">
      <div role="group" aria-label="Isi panel" className="grid grid-cols-4 gap-0.5 rounded-[10px] bg-bg-subtle p-[3px]">
        {tabButton('catatan', 'Catatan', notes.value.trim() ? 'ada' : 'kosong')}
        {listTab('checklist', checklist)}
        {listTab('todos', todos)}
        {tabButton('tanggal', 'Tanggal', dates.current)}
      </div>
      <div className="flex min-h-[158px] flex-col gap-0.5 rounded-xl border border-border bg-surface px-3 py-2.5">
        {tab === 'catatan' ? notes.editor : null}
        {tab === 'checklist' ? <TabList key="checklist" list={checklist} /> : null}
        {tab === 'todos' ? <TabList key="todos" list={todos} /> : null}
        {tab === 'tanggal' ? <DatesBody rail={dates.rail} /> : null}
      </div>
    </div>
  );
}

/* ---- Rail warna ---- */

const HEADER =
  'flex min-h-tap w-full items-center gap-2 text-left text-xs font-semibold text-fg-muted [@media(pointer:fine)]:min-h-6';
const SECTION = 'flex flex-col gap-1.5 border-t border-border p-3 first:border-t-0';

function Chevron({ open }: { open: boolean }): JSX.Element {
  return (
    <IconChevronRight
      aria-hidden="true"
      className={`h-3 w-3 shrink-0 text-fg-faint transition-transform ${open ? 'rotate-90' : ''}`}
    />
  );
}

function RailList({ list, coloured }: { list: PanelList; coloured: boolean }): JSX.Element {
  const [full, setFull] = useState(false);
  return (
    <section className={SECTION}>
      <button type="button" onClick={() => setFull((open) => !open)} aria-expanded={full} className={HEADER}>
        <span className="flex-1">{list.title}</span>
        <Count list={list} />
        <Chevron open={full} />
      </button>
      {list.progress.total > 0 ? (
        // Neutral rail for a list with no colours of its own.
        <div className={coloured ? undefined : '[--token-accent:var(--fg-muted)]'}>
          <ProgressStrip progress={list.progress} mono={!coloured} />
        </div>
      ) : null}
      {full ? (
        list.full ? <div>{list.full}</div> : <Rows list={list} coloured={coloured} all />
      ) : (
        <Rows list={list} coloured={coloured} />
      )}
    </section>
  );
}

/** The same strip as the patient card, so panel and card read the same way. */
export function RailPanels({ content, top }: { content: PanelContent; top: ReactNode }): JSX.Element {
  const { notes, checklist, todos, dates } = content;
  const [notesOpen, setNotesOpen] = useState(false);
  const [datesOpen, setDatesOpenState] = useState(datesOpenKept);
  const setDatesOpen = (next: (open: boolean) => boolean): void =>
    setDatesOpenState((open) => (datesOpenKept = next(open)));
  const note = notes.value.trim();

  return (
    <div className="shrink-0 overflow-hidden rounded-xl border border-border bg-surface">
      {top}
      <section className={SECTION}>
        <button type="button" onClick={() => setNotesOpen((open) => !open)} aria-expanded={notesOpen} className={HEADER}>
          <span className="flex-1">Catatan pasien</span>
          {note ? null : <span className="font-medium">kosong</span>}
          <Chevron open={notesOpen} />
        </button>
        {notesOpen ? (
          notes.editor
        ) : note ? (
          <button type="button" onClick={() => setNotesOpen(true)} aria-label="Buka Catatan pasien" className="text-left">
            <span className="line-clamp-3 whitespace-pre-line text-[13px] leading-snug text-fg-muted">{note}</span>
          </button>
        ) : null}
      </section>
      <RailList list={checklist} coloured />
      <RailList list={todos} coloured={false} />
      <section className={SECTION}>
        {/* Not one button: the arrows are buttons too, and buttons cannot nest. */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDatesOpen((open) => !open)}
            aria-expanded={datesOpen}
            className={`${HEADER.replace('w-full', 'min-w-0 flex-1')}`}
          >
            <span className="truncate">Tanggal{dates.count > 1 ? ` · ${dates.count} hari` : ''}</span>
            <Chevron open={datesOpen} />
          </button>
          <StepButton dir="prev" onStep={dates.prev} />
          <span className="min-w-[3.25rem] text-center text-xs font-medium tabular-nums text-fg-muted">
            {dates.current}
          </span>
          <StepButton dir="next" onStep={dates.next} />
        </div>
        {datesOpen ? <DatesBody rail={dates.rail} /> : null}
      </section>
    </div>
  );
}
