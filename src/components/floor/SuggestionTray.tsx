import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/common/ui';
import { IconBell, IconCalendar, IconCheck, IconChevronRight, IconClose } from '@/components/common/Icons';
import { writeRosterBatch, writeRosterFields, type RosterChange } from '@/data/repositories/floors.repo';
import { formatDmy } from '@/domain/dateDmy';
import { localStamp, type FloorDoc, type RosterPatient } from '@/domain/floorList/floor';
import type { FloorPatient } from '@/domain/floorList/report';
import { buildTray, type TrayAction, type TrayRow } from '@/domain/floorList/suggestionTray';

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const KEY = 'plano.listmaker.tray';
/** Rows shown before "Lihat semua": a full ward would push the list off the phone. */
const LIMIT = 4;
/** How long a tapped row stays, saying what it did, before it folds away. */
const HOLD_MS = 900;
const FOLD_MS = 220;

type Fields = Parameters<typeof writeRosterFields>[2];
type ChiefFields = Extract<RosterChange, { kind: 'fields' }>['fields'];

interface Ghost {
  row: TrayRow;
  index: number;
  text: string;
  phase: 'hold' | 'fold';
}

function readOpen(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

/**
 * Everything the Plan or the clock proposes, in one place at the top of the
 * List Maker (28 Oct 2026, replacing the two amber strips, Avi: "design and
 * revamp the notification"). A proposal never applies itself: each row waits
 * for a tap, and a tapped row stays a moment to say what it did, so a thumb on
 * a ward phone sees the tap land before the list moves.
 */
export function SuggestionTray({
  floor,
  roster,
  active,
  date,
  myName,
  onOpen,
}: {
  floor: FloorDoc;
  roster: readonly RosterPatient[];
  active: readonly FloorPatient[];
  date: string;
  myName: string;
  onOpen: (patient: FloorPatient) => void;
}): JSX.Element | null {
  // The clock moves chief rows in and out at 07.00 / 16.00 without a reload.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const [open, setOpen] = useState(readOpen);
  const [all, setAll] = useState(false);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const timers = useRef<number[]>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const { rows, later } = useMemo(() => buildTray(roster, floor, date, now), [roster, floor, date, now]);

  const items = useMemo(() => {
    const byId = new Map(ghosts.map((ghost) => [ghost.row.id, ghost]));
    const list = rows.map((row) => ({ row, ghost: byId.get(row.id) }));
    // A row the snapshot already took away stays where it was until it folds.
    ghosts
      .filter((ghost) => !rows.some((row) => row.id === ghost.row.id))
      .sort((a, b) => a.index - b.index)
      .forEach((ghost) => list.splice(Math.min(ghost.index, list.length), 0, { row: ghost.row, ghost }));
    return list;
  }, [rows, ghosts]);

  const toggle = (next: boolean): void => {
    setOpen(next);
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      // A private window: the choice just is not remembered.
    }
  };

  const settle = (picked: { row: TrayRow; text: string }[]): void => {
    const ids = new Set(picked.map(({ row }) => row.id));
    setGhosts((prev) => [
      ...prev.filter((ghost) => !ids.has(ghost.row.id)),
      ...picked.map(({ row, text }) => ({ row, text, index: rows.findIndex((r) => r.id === row.id), phase: 'hold' as const })),
    ]);
    const fold = window.setTimeout(
      () => setGhosts((prev) => prev.map((ghost) => (ids.has(ghost.row.id) ? { ...ghost, phase: 'fold' } : ghost))),
      HOLD_MS,
    );
    const gone = window.setTimeout(() => setGhosts((prev) => prev.filter((ghost) => !ids.has(ghost.row.id))), HOLD_MS + FOLD_MS);
    timers.current.push(fold, gone);
  };

  const stamp = (what: string) => ({ at: new Date().toISOString(), by: myName, what });
  const run = (row: TrayRow, action: TrayAction): void => {
    const { fields, log } = action.write;
    void writeRosterFields(floor.id, row.key, fields as Fields, log ? stamp(log.what) : undefined);
    settle([{ row, text: action.done }]);
  };
  const runAll = (chief: TrayRow[], pick: (row: TrayRow) => TrayAction): void => {
    const changes = chief.map((row): RosterChange => {
      const { fields, log } = pick(row).write;
      return { kind: 'fields', key: row.key, fields: fields as ChiefFields, ...(log ? { log: stamp(log.what) } : {}) };
    });
    void writeRosterBatch(floor.id, changes);
    settle(chief.map((row) => ({ row, text: pick(row).done })));
  };

  const chiefRows = rows.filter((row) => row.kind === 'chief' && !items.some((item) => item.row.id === row.id && item.ghost));
  const discharge = rows.filter((row) => row.kind === 'discharge').length;
  const laterLine = later ? (
    <p className="flex items-center gap-1.5 text-xs text-fg-muted">
      <IconCalendar width={14} height={14} />
      {later.count} pasien ganti chief · {DAYS[later.at.getDay()]} {formatDmy(localStamp(later.at).slice(0, 10)).slice(0, 5)} 07.00
    </p>
  ) : null;

  if (items.length === 0) return laterLine;

  const visible = all ? items : items.slice(0, LIMIT);
  const hidden = items.length - visible.length;
  const summary =
    rows.length === 0
      ? 'Semua sudah ditangani'
      : [discharge > 0 ? `${discharge} soal pulang` : '', rows.length - discharge > 0 ? `${rows.length - discharge} ganti chief` : '']
          .filter(Boolean)
          .join(' · ');

  return (
    <div className="space-y-1.5">
      <section aria-label="Saran" className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => toggle(!open)}
          className="flex min-h-tap w-full items-center gap-2 px-3 text-left"
        >
          <IconBell width={16} height={16} className="shrink-0 text-fg-muted" />
          <span className="text-sm font-semibold">Saran</span>
          {rows.length > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--warn-soft)] px-1.5 text-[11px] font-semibold tabular-nums">
              {rows.length}
            </span>
          ) : null}
          <span aria-live="polite" className="min-w-0 flex-1 truncate text-xs text-fg-muted">
            {summary}
          </span>
          <IconChevronRight
            width={16}
            height={16}
            className={`shrink-0 text-fg-faint transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          />
        </button>

        <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className={`min-h-0 overflow-hidden ${open ? '' : 'invisible transition-[visibility] delay-200 duration-0'}`}>
            <ul className="divide-y divide-border border-t border-border">
              {visible.map(({ row, ghost }) => (
                <Row key={row.id} row={row} ghost={ghost} shown={active.find((p) => p.key === row.key)} onOpen={onOpen} onRun={run} />
              ))}
            </ul>
            {items.length > LIMIT ? (
              <Button size="sm" variant="quiet" full className="rounded-none border-t border-border" onClick={() => setAll(!all)}>
                {all ? 'Ringkas' : `Lihat ${hidden} lainnya`}
              </Button>
            ) : null}
            {chiefRows.length > 1 ? (
              <div className="flex items-center gap-1.5 border-t border-border bg-bg-subtle px-3 py-1">
                <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">{chiefRows.length} chief</span>
                <Button size="sm" variant="quiet" onClick={() => runAll(chiefRows, (row) => row.dismiss)}>
                  Abaikan semua
                </Button>
                <Button size="sm" onClick={() => runAll(chiefRows, (row) => row.actions[0] ?? row.dismiss)}>
                  Terima semua
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </section>
      {laterLine}
    </div>
  );
}

function Row({
  row,
  ghost,
  shown,
  onOpen,
  onRun,
}: {
  row: TrayRow;
  ghost: Ghost | undefined;
  shown: FloorPatient | undefined;
  onOpen: (patient: FloorPatient) => void;
  onRun: (row: TrayRow, action: TrayAction) => void;
}): JSX.Element {
  const done = ghost !== undefined;
  const fold = ghost?.phase === 'fold';
  const where = row.room ? `${row.room}${row.bed ? `/${row.bed}` : ''}` : '';
  // One answer sits beside the dismiss button; an usul has two, which get their own line on a phone.
  const single = row.actions.length === 1;
  const inert = done ? { 'aria-hidden': true, tabIndex: -1 } : {};
  return (
    <li
      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${fold ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
          <div className="min-w-0 flex-1 basis-40">
            <button
              type="button"
              disabled={!shown || done}
              onClick={() => shown && onOpen(shown)}
              className="block max-w-full truncate py-0.5 text-left text-sm hover:underline disabled:no-underline"
            >
              {where ? <span className="mr-1.5 font-semibold tabular-nums">{where}</span> : null}
              <span className="font-medium">{row.name}</span>
            </button>
            {done ? (
              <p className="flex items-center gap-1 text-xs text-fg-muted">
                <IconCheck width={14} height={14} className="shrink-0 text-fg" />
                <span className="truncate">{ghost.text}</span>
              </p>
            ) : (
              <p className="text-xs leading-relaxed text-fg-muted">
                {row.lead}{' '}
                <strong
                  className={`rounded px-1 py-px font-semibold text-fg ${row.kind === 'discharge' ? 'bg-[var(--warn-soft)]' : 'bg-bg-subtle'}`}
                >
                  {row.strong}
                </strong>
                {row.tail ? ` ${row.tail}` : ''}
              </p>
            )}
          </div>
          <div className={`flex items-center gap-1 ${done ? 'invisible' : ''}`}>
            <Button
              size="sm"
              variant="quiet"
              aria-label={`Abaikan saran untuk ${row.name}`}
              {...inert}
              onClick={() => onRun(row, row.dismiss)}
            >
              <IconClose width={16} height={16} className="sm:hidden" />
              <span className="hidden sm:inline">{row.dismiss.label}</span>
            </Button>
            {single && row.actions[0] ? (
              <Button size="sm" {...inert} onClick={() => onRun(row, row.actions[0] as TrayAction)}>
                {row.actions[0].label}
              </Button>
            ) : null}
          </div>
          {single ? null : (
            <div className={`flex w-full flex-wrap gap-1.5 sm:w-auto ${done ? 'invisible' : ''}`} {...(done ? { 'aria-hidden': true } : {})}>
              {row.actions.map((action) => (
                <Button key={action.label} size="sm" tabIndex={done ? -1 : 0} onClick={() => onRun(row, action)}>
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
