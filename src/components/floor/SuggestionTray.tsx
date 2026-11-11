import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/common/ui';
import { IconBell, IconCheck, IconChevronRight, IconClose } from '@/components/common/Icons';
import { writeRosterBatch, writeRosterFields, type RosterChange } from '@/data/repositories/floors.repo';
import type { FloorDoc, RosterPatient } from '@/domain/floorList/floor';
import type { FloorPatient } from '@/domain/floorList/report';
import { buildTray, groupTray, type TrayAction, type TrayRow } from '@/domain/floorList/suggestionTray';

const KEY = 'plano.listmaker.tray';
/** Patient chips shown per line before "+n": a full ward would push the list off the phone. */
const LIMIT = 6;

type Fields = Parameters<typeof writeRosterFields>[2];
type ChiefFields = Extract<RosterChange, { kind: 'fields' }>['fields'];

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
 * revamp the notification"). A proposal never applies itself: each waits for
 * a tap, and Abaikan is always there.
 *
 * One line per proposal, not per patient (11 Nov 2026, Avi: the patient rows
 * took too much height): "Plan menyebut H-1", "Ganti chief → dr. Didi", each
 * with its patients as chips (name opens, ✓ answers one, × dismisses one) and
 * the answers for the whole line at its end.
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
  // Lines showing all their patients, not the first LIMIT.
  const [wide, setWide] = useState<readonly string[]>([]);
  // What the last tap did, read out (the chip itself leaves with the snapshot).
  const [said, setSaid] = useState('');

  const { rows } = useMemo(() => buildTray(roster, floor, date, now), [roster, floor, date, now]);
  const groups = useMemo(() => groupTray(rows), [rows]);

  const toggle = (next: boolean): void => {
    setOpen(next);
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      // A private window: the choice just is not remembered.
    }
  };

  const stamp = (what: string) => ({ at: new Date().toISOString(), by: myName, what });
  const run = (row: TrayRow, action: TrayAction): void => {
    const { fields, log } = action.write;
    void writeRosterFields(floor.id, row.key, fields as Fields, log ? stamp(log.what) : undefined);
    setSaid(`${row.room}${row.bed ? `/${row.bed}` : ''} ${row.name}: ${action.done}`);
  };
  const runAll = (list: readonly TrayRow[], pick: (row: TrayRow) => TrayAction): void => {
    const changes = list.map((row): RosterChange => {
      const { fields, log } = pick(row).write;
      return { kind: 'fields', key: row.key, fields: fields as ChiefFields, ...(log ? { log: stamp(log.what) } : {}) };
    });
    void writeRosterBatch(floor.id, changes);
    setSaid(`${list.length} pasien: ${list[0] ? pick(list[0]).done : ''}`);
  };

  if (rows.length === 0) return null;
  const discharge = rows.filter((row) => row.kind === 'discharge').length;
  const summary = [discharge > 0 ? `${discharge} soal pulang` : '', rows.length - discharge > 0 ? `${rows.length - discharge} ganti chief` : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <section aria-label="Saran" className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <button type="button" aria-expanded={open} onClick={() => toggle(!open)} className="flex min-h-tap w-full items-center gap-2 px-3 text-left">
        <IconBell width={16} height={16} className="shrink-0 text-fg-muted" />
        <span className="text-sm font-semibold">Saran</span>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--warn-soft)] px-1.5 text-[11px] font-semibold tabular-nums">
          {rows.length}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">{summary}</span>
        <IconChevronRight width={16} height={16} className={`shrink-0 text-fg-faint transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
      </button>
      <p aria-live="polite" className="sr-only">
        {said}
      </p>

      {open ? (
        <ul className="divide-y divide-border border-t border-border">
          {groups.map((group) => {
            const all = wide.includes(group.id);
            const shown = all ? group.rows : group.rows.slice(0, LIMIT);
            const more = group.rows.length - shown.length;
            const first = group.rows[0]!;
            const many = group.rows.length > 1;
            return (
              <li key={group.id} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-2">
                <span className="text-xs font-semibold">
                  <span className={`rounded px-1 py-px ${group.kind === 'discharge' ? 'bg-[var(--warn-soft)]' : 'bg-bg-subtle'}`}>{group.title}</span>
                  <span className="ml-1 tabular-nums text-fg-muted">{group.rows.length}</span>
                </span>
                {shown.map((row) => (
                  <Chip
                    key={row.id}
                    row={row}
                    answer={first.actions.length === 1 ? row.actions[0] : undefined}
                    shown={active.find((p) => p.key === row.key)}
                    onOpen={onOpen}
                    onRun={run}
                  />
                ))}
                {more > 0 || all ? (
                  <button
                    type="button"
                    onClick={() => setWide((w) => (all ? w.filter((id) => id !== group.id) : [...w, group.id]))}
                    className="min-h-8 rounded-full px-2 text-xs font-semibold text-fg-muted hover:text-fg"
                  >
                    {all ? 'Ringkas' : `+${more} lagi`}
                  </button>
                ) : null}
                <span className="ml-auto flex flex-wrap items-center gap-1">
                  <Button size="sm" variant="quiet" onClick={() => runAll(group.rows, (row) => row.dismiss)}>
                    {many ? 'Abaikan semua' : 'Abaikan'}
                  </Button>
                  {first.actions.map((action, i) => (
                    <Button key={action.label} size="sm" onClick={() => runAll(group.rows, (row) => row.actions[i] ?? row.dismiss)}>
                      {many ? `${action.label} semua` : action.label}
                    </Button>
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

/** One patient on a line: the name opens it; ✓ answers it alone (one-answer lines only), × dismisses it. */
function Chip({
  row,
  answer,
  shown,
  onOpen,
  onRun,
}: {
  row: TrayRow;
  answer: TrayAction | undefined;
  shown: FloorPatient | undefined;
  onOpen: (patient: FloorPatient) => void;
  onRun: (row: TrayRow, action: TrayAction) => void;
}): JSX.Element {
  const where = row.room ? `${row.room}${row.bed ? `/${row.bed}` : ''}` : '';
  const icon = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-bg-subtle hover:text-fg';
  return (
    <span className="inline-flex max-w-full items-center rounded-full border border-border pl-2.5 text-xs">
      <button
        type="button"
        disabled={!shown}
        onClick={() => shown && onOpen(shown)}
        title={row.name}
        className="min-h-8 min-w-0 truncate text-left hover:underline disabled:no-underline"
      >
        {where ? <span className="mr-1 font-semibold tabular-nums">{where}</span> : null}
        {row.name}
      </button>
      {answer ? (
        <button type="button" aria-label={`${answer.label}: ${row.name}`} title={answer.label} onClick={() => onRun(row, answer)} className={icon}>
          <IconCheck width={14} height={14} />
        </button>
      ) : null}
      <button type="button" aria-label={`Abaikan saran untuk ${row.name}`} title="Abaikan" onClick={() => onRun(row, row.dismiss)} className={icon}>
        <IconClose width={14} height={14} />
      </button>
    </span>
  );
}
