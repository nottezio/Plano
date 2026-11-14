import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/common/ui';
import { IconBell, IconCheck, IconClose } from '@/components/common/Icons';
import { writeRosterBatch, writeRosterFields, type RosterChange } from '@/data/repositories/floors.repo';
import type { FloorDoc, RosterPatient } from '@/domain/floorList/floor';
import type { FloorPatient } from '@/domain/floorList/report';
import { buildTray, groupTray, type TrayAction, type TrayRow } from '@/domain/floorList/suggestionTray';
import { useBackToClose } from '@/lib/useBackToClose';

/** Patient chips shown per line before "+n": a full ward would push the list off the phone. */
const LIMIT = 6;

type Fields = Parameters<typeof writeRosterFields>[2];
type ChiefFields = Extract<RosterChange, { kind: 'fields' }>['fields'];

/**
 * Everything the Plan or the clock proposes, in one place in the List Maker
 * (28 Oct 2026, replacing the two amber strips). A proposal never applies
 * itself: each waits for a tap, and Abaikan is always there.
 *
 * One line per proposal, not per patient (11 Nov 2026): "Plan menyebut H-1",
 * "Ganti chief → dr. Didi", each with its patients as chips (name opens,
 * ✓ answers one, × dismisses one) and the answers for the whole line.
 *
 * A floating bell with the open count since 14 Nov 2026 (Avi: the box above the
 * Denah was poor UI): nothing above the first patient, the list opens on a tap
 * as a panel beside the button (a bottom sheet on a phone). Non-modal: Esc, a tap
 * outside or × closes it, and focus goes back to the bell. Hidden with nothing
 * to answer. The caller places it (the List Maker's floating stack).
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

  const [open, setOpen] = useState(false);
  useBackToClose(open, () => setOpen(false));
  // Lines showing all their patients, not the first LIMIT.
  const [wide, setWide] = useState<readonly string[]>([]);
  // What the last tap did, read out (the chip itself leaves with the snapshot).
  const [said, setSaid] = useState('');

  const { rows } = useMemo(() => buildTray(roster, floor, date, now), [roster, floor, date, now]);
  const groups = useMemo(() => groupTray(rows), [rows]);

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
  // Opening a patient hands the screen to its SOAP box.
  const openPatient = (patient: FloorPatient): void => {
    setOpen(false);
    onOpen(patient);
  };

  // Kept while open, so answering the last proposal does not pull the panel (and focus) away.
  if (rows.length === 0 && !open) return null;
  const count = (kind: TrayRow['kind']): number => rows.filter((row) => row.kind === kind).length;
  const [discharge, chief, noChief] = [count('discharge'), count('chief'), count('nochief')];
  const summary = [discharge > 0 ? `${discharge} soal pulang` : '', chief > 0 ? `${chief} ganti chief` : '', noChief > 0 ? `${noChief} belum ada chief` : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <Dialog.Root open={open} onOpenChange={setOpen} modal={false}>
      <Dialog.Trigger
        aria-label={`Saran, ${rows.length} menunggu`}
        title="Saran"
        className={`relative flex h-12 w-12 items-center justify-center rounded-full border shadow-pop transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          open ? 'border-accent bg-[var(--accent-soft)] text-accent' : 'border-border-strong bg-surface text-fg hover:border-accent hover:text-accent'
        }`}
      >
        <IconBell width={22} height={22} />
        {rows.length > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-surface bg-[var(--warn-soft)] px-1 text-[11px] font-semibold tabular-nums text-fg"
          >
            {rows.length}
          </span>
        ) : null}
      </Dialog.Trigger>
      <p aria-live="polite" className="sr-only">
        {said}
      </p>
      <Dialog.Portal>
        <Dialog.Content
          onOpenAutoFocus={(event) => {
            // Focus the panel, not its first button: no ring on a control nobody moved to (see Sheet).
            event.preventDefault();
            (event.currentTarget as HTMLElement | null)?.focus({ preventScroll: true });
          }}
          className={[
            'fixed z-50 flex flex-col border border-border bg-surface shadow-sheet outline-none',
            // Phone: a bottom sheet over the tab bar.
            'inset-x-0 bottom-0 max-h-[75dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]',
            // From 640 px: beside the floating stack, its bottom level with the stack's (see ListMakerPage).
            'sm:inset-x-auto sm:bottom-[4.25rem] sm:left-[160px] sm:max-h-[min(70dvh,36rem)] sm:w-[26rem] sm:rounded-2xl sm:pb-0 lg:bottom-4 lg:left-[316px]',
          ].join(' ')}
        >
          <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-border sm:hidden" />
          <header className="flex items-start gap-2 px-4 pb-2 pt-2 sm:pt-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-[15px] font-semibold leading-tight">
                Saran <span className="tabular-nums text-fg-muted">{rows.length}</span>
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-fg-muted">{summary || 'Semua saran sudah dijawab.'}</Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Tutup Saran"
              className="-mr-2 flex min-h-tap min-w-tap items-center justify-center rounded-full text-fg-muted hover:bg-bg-subtle hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <IconClose width={18} height={18} />
            </Dialog.Close>
          </header>
          {groups.length > 0 ? (
            <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto overscroll-contain border-t border-border">
              {groups.map((group) => {
                const all = wide.includes(group.id);
                const shown = all ? group.rows : group.rows.slice(0, LIMIT);
                const more = group.rows.length - shown.length;
                const first = group.rows[0]!;
                const many = group.rows.length > 1;
                return (
                  <li key={group.id} className="space-y-2 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                      <span className="mr-auto text-xs font-semibold">
                        <span className={`rounded px-1.5 py-0.5 ${group.kind !== 'chief' ? 'bg-[var(--warn-soft)]' : 'bg-bg-subtle'}`}>{group.title}</span>
                        <span className="ml-1.5 tabular-nums text-fg-muted">{group.rows.length}</span>
                      </span>
                      <Button size="sm" variant="quiet" onClick={() => runAll(group.rows, (row) => row.dismiss)}>
                        {many ? 'Abaikan semua' : 'Abaikan'}
                      </Button>
                      {first.actions.map((action, i) => (
                        <Button key={action.label} size="sm" onClick={() => runAll(group.rows, (row) => row.actions[i] ?? row.dismiss)}>
                          {many ? `${action.label} semua` : action.label}
                        </Button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {shown.map((row) => (
                        <Chip
                          key={row.id}
                          row={row}
                          answer={first.actions.length === 1 ? row.actions[0] : undefined}
                          shown={active.find((p) => p.key === row.key)}
                          onOpen={openPatient}
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
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
