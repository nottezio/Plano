import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/common/ui';
import { IconBell, IconClose } from '@/components/common/Icons';
import { writeRosterBatch, writeRosterFields, type RosterChange } from '@/data/repositories/floors.repo';
import type { FloorDoc, RosterPatient } from '@/domain/floorList/floor';
import type { FloorPatient } from '@/domain/floorList/report';
import { buildTray, type TrayAction, type TrayRow } from '@/domain/floorList/suggestionTray';
import { useBackToClose } from '@/lib/useBackToClose';

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
  // What the last tap did, read out (the chip itself leaves with the snapshot).
  const [said, setSaid] = useState('');

  const { rows } = useMemo(() => buildTray(roster, floor, date, now), [roster, floor, date, now]);
  // Rows with a change to accept; a 'belum ada chief' reminder has none.
  const acceptable = rows.filter((row) => row.actions.length > 0);

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
        className={`relative flex h-10 w-10 items-center justify-center rounded-full border shadow-card transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          open ? 'border-accent bg-[var(--accent-soft)] text-accent' : 'border-border-strong bg-surface text-fg-muted hover:border-accent hover:text-accent'
        }`}
      >
        <IconBell width={18} height={18} />
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
          {rows.length > 0 ? (
            <>
              {/* One answer for everything (14 Nov 2026, Avi): ACC applies each row's change; reminders only go with Abaikan semua. */}
              <div className="flex gap-2 border-t border-border px-4 py-2">
                <Button size="sm" variant="primary" disabled={acceptable.length === 0} onClick={() => runAll(acceptable, (row) => row.actions[0]!)}>
                  Terima semua{acceptable.length > 0 ? ` (${acceptable.length})` : ''}
                </Button>
                <Button size="sm" onClick={() => runAll(rows, (row) => row.dismiss)}>
                  Abaikan semua
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-bg-subtle text-[11px] uppercase tracking-wide text-fg-faint">
                    <tr>
                      <th scope="col" className="px-4 py-1.5 font-semibold">Pasien</th>
                      <th scope="col" className="py-1.5 font-semibold">Saran</th>
                      <th scope="col" className="px-4 py-1.5 text-right font-semibold">
                        <span className="sr-only">Jawaban</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((row) => (
                      <Row key={row.id} row={row} shown={active.find((p) => p.key === row.key)} onOpen={openPatient} onRun={run} />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * One patient (14 Nov 2026, Avi: the per-group buttons were confusing): who, what would change, and
 * two answers. ACC applies the first proposed change (for "usul H-1" that is Tandai usul; Sudah pasti
 * H-1 stays in Atur). A "belum ada chief" reminder has nothing to accept: Isi opens the patient.
 */
function Row({
  row,
  shown,
  onOpen,
  onRun,
}: {
  row: TrayRow;
  shown: FloorPatient | undefined;
  onOpen: (patient: FloorPatient) => void;
  onRun: (row: TrayRow, action: TrayAction) => void;
}): JSX.Element {
  const where = row.room ? `${row.room}${row.bed ? `/${row.bed}` : ''}` : '';
  const accept = row.actions[0];
  return (
    <tr className="align-middle">
      <td className="max-w-[9rem] py-2 pl-4 pr-2">
        <button
          type="button"
          disabled={!shown}
          onClick={() => shown && onOpen(shown)}
          title={row.name}
          className="block min-h-8 w-full truncate text-left hover:underline disabled:no-underline"
        >
          {where ? <span className="mr-1 font-semibold tabular-nums">{where}</span> : null}
          {row.name}
        </button>
      </td>
      <td className="py-2 pr-2 text-fg-muted">
        {row.lead} <strong className="font-semibold text-fg">{row.strong}</strong>
        {accept ? <span className="block text-[11px] text-fg-faint">ACC: {accept.done}</span> : null}
      </td>
      <td className="whitespace-nowrap py-2 pr-4 text-right">
        {accept ? (
          <Button size="sm" variant="secondary" aria-label={`ACC ${accept.done}: ${row.name}`} onClick={() => onRun(row, accept)}>
            ACC
          </Button>
        ) : shown ? (
          <Button size="sm" variant="secondary" aria-label={`Isi chief: ${row.name}`} onClick={() => onOpen(shown)}>
            Isi
          </Button>
        ) : null}
        <Button size="sm" variant="quiet" aria-label={`Abaikan saran untuk ${row.name}`} onClick={() => onRun(row, row.dismiss)} className="ml-1">
          Abaikan
        </Button>
      </td>
    </tr>
  );
}
