import { useEffect, useMemo, useState, type DragEvent } from 'react';

import { Button, Callout } from '@/components/common/ui';
import { IconClose } from '@/components/common/Icons';
import { writeRosterBatch, type RosterChange } from '@/data/repositories/floors.repo';
import { assignedRecently } from '@/domain/floorList/analysis';
import { assignGroup, loadsWith, needsHolder, proposeAssignment, residentOf } from '@/domain/floorList/assign';
import { byRoute, dpjpCodeOf } from '@/domain/floorList/build';
import { chiefsOf, type FloorDoc, type RosterPatient } from '@/domain/floorList/floor';
import type { FloorPatient } from '@/domain/floorList/report';
import { DischargeChip, FLAG_TEXT } from './DischargeChip';

const GROUP_LABEL = { mz: 'MZ', trio: 'Trio', lain: '' } as const;
const DRAG_TYPE = 'text/plain';

/** The board as left (11 Nov 2026, Avi: "I'm still rethinking it, don't reset it"): per list, on this device. */
interface Board {
  skip: string[];
  placed: Record<string, string>;
}
const boardKey = (floorId: string): string => `plano.assign.${floorId}`;

function readBoard(floorId: string): Board {
  try {
    const raw = JSON.parse(localStorage.getItem(boardKey(floorId)) ?? 'null') as Partial<Board> | null;
    const skip = Array.isArray(raw?.skip) ? raw.skip.filter((x): x is string => typeof x === 'string') : [];
    const placed =
      raw?.placed && typeof raw.placed === 'object'
        ? Object.fromEntries(Object.entries(raw.placed).filter((e): e is [string, string] => typeof e[1] === 'string'))
        : {};
    return { skip, placed };
  } catch {
    return { skip: [], placed: {} };
  }
}

function writeBoard(floorId: string, board: Board): void {
  try {
    if (board.skip.length === 0 && Object.keys(board.placed).length === 0) localStorage.removeItem(boardKey(floorId));
    else localStorage.setItem(boardKey(floorId), JSON.stringify(board));
  } catch {
    // A private window or full storage: the board just is not kept.
  }
}

/**
 * Bagi pasien as clipboards (11 Nov 2026, Avi: "make it fun… drag the card to
 * the resident box… like a clipboard"). Each floor resident has a clipboard
 * with the patients they already follow; every patient no floor resident
 * holds is a card. Drag a card onto a clipboard (or tap the card, then the
 * clipboard: phones have no drag), drag it back to take it off. "Usulkan"
 * fills the clipboards from `proposeAssignment` (MZ, Trio, then total load),
 * leaving out the residents switched off under "Ikut diusulkan".
 *
 * The board (placements and "Ikut diusulkan") is kept on the device per
 * list until Terapkan or Kosongkan papan, so leaving the tab does not lose
 * it. Each clipboard also shows how many patients Bagi pasien gave that
 * resident in the last 7 days (from the roster log), so today's share can
 * even out the week.
 *
 * Nothing is written until Terapkan, which sets the junior on the placed
 * patients only. Firestore: no read (the roster is already loaded);
 * Terapkan = one write per placed patient, in one batch.
 */
export function AssignPanel({
  floor,
  active,
  roster,
  date,
  editable,
  myName,
  onOpen,
}: {
  floor: FloorDoc;
  active: readonly FloorPatient[];
  /** Everyone ever on the list, for the 7-day count. */
  roster: readonly RosterPatient[];
  date: string;
  editable: boolean;
  myName: string;
  onOpen: (patient: FloorPatient) => void;
}): JSX.Element {
  const residentsKey = floor.juniors;
  const residents = useMemo(() => chiefsOf(residentsKey), [residentsKey]);
  const sorted = useMemo(() => [...active].sort(byRoute(floor.ward)), [active, floor.ward]);
  const open = useMemo(() => sorted.filter((p) => needsHolder(p, residents)), [sorted, residents]);
  // Residents "Usulkan" leaves out (11 Nov 2026: the list maker usually takes the fewest). Not saved.
  const [initial] = useState(() => readBoard(floor.id));
  const [skip, setSkip] = useState<readonly string[]>(initial.skip);
  // Card key → resident, as placed by hand or by Usulkan. Read against `open`, so a patient someone else took drops out.
  const [placed, setPlaced] = useState<Readonly<Record<string, string>>>(initial.placed);
  useEffect(() => writeBoard(floor.id, { skip: [...skip], placed: { ...placed } }), [floor.id, skip, placed]);
  const week = useMemo(() => new Map(assignedRecently(roster, residents, date).map((x) => [x.name, x.count])), [roster, residents, date]);
  // Tap mode: the card picked up, waiting for a clipboard.
  const [held, setHeld] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [done, setDone] = useState('');

  const chosen = useMemo(() => {
    const out = new Map<string, string>();
    for (const p of open) {
      const to = placed[p.key];
      if (to && residents.includes(to)) out.set(p.key, to);
    }
    return out;
  }, [open, placed, residents]);
  const loads = useMemo(() => new Map(loadsWith(sorted, residents, chosen).map((l) => [l.name, l])), [sorted, residents, chosen]);
  const waiting = open.filter((p) => !chosen.has(p.key));

  const place = (key: string, to: string | null): void => {
    setPlaced((prev) => {
      const { [key]: _old, ...rest } = prev;
      return to ? { ...rest, [key]: to } : rest;
    });
    setHeld(null);
    setDone('');
  };
  const propose = (): void => {
    setPlaced(Object.fromEntries(proposeAssignment(sorted, residents, new Set(skip))));
    setHeld(null);
    setDone('');
  };
  const apply = (): void => {
    const at = new Date().toISOString();
    const changes: RosterChange[] = [...chosen].map(([key, to]) => ({
      kind: 'fields' as const,
      key,
      fields: { junior: to },
      log: { at, by: myName, what: `Bagi pasien: junior dr. ${to}` },
    }));
    if (changes.length === 0) return;
    // Not awaited: offline the batch resolves only when the server confirms; the cache shows it at once.
    void writeRosterBatch(floor.id, changes);
    setPlaced({});
    setDone(`${changes.length} pasien dibagi.`);
  };

  const dropOn = (target: string | null) => ({
    onDragOver: (e: DragEvent) => {
      if (!editable) return;
      e.preventDefault();
      setOver(target ?? '');
    },
    onDragLeave: () => setOver(null),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setOver(null);
      const key = e.dataTransfer.getData(DRAG_TYPE);
      if (open.some((p) => p.key === key)) place(key, target);
    },
  });

  const card = (p: FloorPatient, placedHere: boolean): JSX.Element => (
    <PatientCard
      key={p.key}
      patient={p}
      editable={editable}
      placed={placedHere}
      held={held === p.key}
      onPick={() => setHeld(held === p.key ? null : p.key)}
      onOpen={() => onOpen(p)}
      onReturn={() => place(p.key, null)}
    />
  );

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="flex-1 text-sm font-semibold">Bagi pasien ke residen lantai</h3>
        <span className="text-xs text-fg-muted">{open.length} pasien belum dipegang residen lantai</span>
      </div>
      <p className="text-xs text-fg-muted">
        Seret kartu pasien ke papan residen{editable ? ' (atau ketuk kartu, lalu ketuk papannya)' : ''}. Pasien yang sudah dipegang residen lantai,
        pasien divisi, dan pasien “tidak di-follow up” tidak ikut. Usulkan mengisi papan otomatis: MZ dulu, lalu Trio (AFM, AFG, ZD) merata, lalu
        sisanya ke yang pasiennya paling sedikit.
      </p>

      {residents.length === 0 ? (
        <Callout tone="info">Isi dulu Residen lantai di tab Setelan.</Callout>
      ) : (
        <>
          {/* The waiting cards: also where a card is dropped to take it off a clipboard. */}
          <div
            {...dropOn(null)}
            className={`min-h-16 rounded-xl border border-dashed p-2 transition-colors ${over === '' ? 'border-accent bg-[var(--accent-soft)]' : 'border-border'}`}
          >
            <p className="mb-1.5 text-xs font-semibold text-fg-muted">
              Belum dipegang <span className="tabular-nums">{waiting.length}</span>
            </p>
            {waiting.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">{waiting.map((p) => card(p, false))}</ul>
            ) : (
              <p className="text-xs text-fg-muted">{done || (open.length === 0 ? 'Semua pasien sudah dipegang residen lantai.' : 'Semua kartu sudah di papan.')}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {residents.map((r) => {
              const load = loads.get(r);
              const kept = sorted.filter((p) => !p.division && !p.tags?.some((t) => t.noFollowUp) && residentOf(p.junior, residents) === r);
              const fresh = open.filter((p) => chosen.get(p.key) === r);
              const target = editable && held !== null;
              return (
                <div
                  key={r}
                  {...dropOn(r)}
                  className={`relative rounded-xl border bg-bg-subtle px-2.5 pb-2.5 pt-4 transition-colors ${
                    over === r ? 'border-accent ring-2 ring-accent' : target ? 'border-accent' : 'border-border'
                  }`}
                >
                  {/* The clip. */}
                  <span aria-hidden="true" className="absolute -top-1.5 left-1/2 h-3.5 w-14 -translate-x-1/2 rounded-md border border-border bg-surface shadow-card" />
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
                    <h4 className="min-w-0 flex-1 truncate text-sm font-semibold">dr. {r}</h4>
                    {load ? (
                      <span className="text-xs tabular-nums text-fg-muted">
                        {load.after.total > load.before.total ? (
                          <>
                            {load.before.total} → <strong className="text-fg">{load.after.total}</strong>
                          </>
                        ) : (
                          load.after.total
                        )}{' '}
                        pasien · MZ {load.after.mz} · Trio {load.after.trio}
                      </span>
                    ) : null}
                    <span className="w-full text-[11px] text-fg-muted">Dapat {week.get(r) ?? 0} pasien baru dalam 7 hari</span>
                    <GoingHome patients={kept} />
                  </div>
                  {target ? (
                    <button
                      type="button"
                      onClick={() => held && place(held, r)}
                      className="mb-2 min-h-tap w-full rounded-lg border border-dashed border-accent text-xs font-semibold text-accent [@media(pointer:fine)]:min-h-9"
                    >
                      Taruh di papan dr. {r}
                    </button>
                  ) : null}
                  {fresh.length > 0 ? <ul className="mb-2 flex flex-wrap gap-1.5">{fresh.map((p) => card(p, true))}</ul> : null}
                  {kept.length > 0 ? (
                    <ul className="space-y-0.5 rounded-lg bg-surface p-1.5 text-xs">
                      {kept.map((p) => (
                        <li key={p.key}>
                          <button type="button" onClick={() => onOpen(p)} className="flex w-full items-baseline gap-1.5 text-left hover:underline">
                            <span className="shrink-0 font-semibold tabular-nums">
                              {p.room || '—'}
                              {p.bed ? `/${p.bed}` : ''}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{p.name || p.identity}</span>
                            <Badges patient={p} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : fresh.length === 0 ? (
                    <p className="rounded-lg bg-surface p-1.5 text-xs text-fg-muted">Belum memegang pasien.</p>
                  ) : null}
                </div>
              );
            })}
          </div>

          {editable ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-fg-muted">Ikut diusulkan:</span>
                {residents.map((r) => {
                  const on = !skip.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSkip((s) => (on ? [...s, r] : s.filter((x) => x !== r)))}
                      className={`min-h-8 rounded-full border px-2.5 font-semibold ${on ? 'border-accent bg-accent text-on-accent' : 'border-border text-fg-muted line-through'}`}
                    >
                      dr. {r}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" onClick={apply} disabled={chosen.size === 0}>
                  Terapkan ({chosen.size})
                </Button>
                <Button variant="secondary" onClick={propose} disabled={open.length === 0 || skip.length === residents.length}>
                  Usulkan
                </Button>
                {chosen.size > 0 ? (
                  <Button variant="ghost" onClick={() => setPlaced({})}>
                    Kosongkan papan
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}

function Badges({ patient }: { patient: FloorPatient }): JSX.Element {
  const group = GROUP_LABEL[assignGroup(patient)];
  const code = dpjpCodeOf(patient);
  return (
    <>
      <DischargeChip patient={patient} />
      {code ? <span className="shrink-0 rounded border border-border px-1 text-[11px] font-semibold text-fg-muted">{code}</span> : null}
      {group && group !== code ? <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-1.5 text-[11px] font-semibold text-accent">{group}</span> : null}
    </>
  );
}

/** How many of a resident's patients go home today or tomorrow (11 Nov 2026, Avi): a load that is about to lighten. */
function GoingHome({ patients }: { patients: readonly FloorPatient[] }): JSX.Element | null {
  const today = patients.filter((p) => p.discharge === 'today').length;
  const h1 = patients.filter((p) => p.discharge === 'tomorrow').length;
  if (today + h1 === 0) return null;
  return (
    <span className="w-full text-[11px] font-semibold">
      {today > 0 ? <span style={{ color: FLAG_TEXT.today }}>Pulang hari ini {today}</span> : null}
      {today > 0 && h1 > 0 ? <span className="text-fg-muted"> · </span> : null}
      {h1 > 0 ? <span style={{ color: FLAG_TEXT.tomorrow }}>H-1 {h1}</span> : null}
    </span>
  );
}

/** A patient waiting for (or newly placed with) a resident: drag it, or tap to pick it up. */
function PatientCard({
  patient,
  editable,
  placed,
  held,
  onPick,
  onOpen,
  onReturn,
}: {
  patient: FloorPatient;
  editable: boolean;
  placed: boolean;
  held: boolean;
  onPick: () => void;
  onOpen: () => void;
  onReturn: () => void;
}): JSX.Element {
  const label = `${patient.room || '—'}${patient.bed ? `/${patient.bed}` : ''} ${patient.name || patient.identity}`;
  return (
    <li
      draggable={editable}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, patient.key);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={`flex max-w-full items-center gap-1 rounded-lg border bg-surface py-0.5 pl-2 pr-0.5 text-xs shadow-card ${
        held ? 'border-accent ring-2 ring-accent' : placed ? 'border-accent' : 'border-border'
      } ${editable ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <button
        type="button"
        aria-pressed={editable ? held : undefined}
        aria-label={editable ? `${held ? 'Batal pilih' : 'Pilih'} ${label}` : label}
        onClick={() => (editable ? onPick() : onOpen())}
        className="flex min-h-8 min-w-0 items-center gap-1.5 text-left"
      >
        <span className="shrink-0 font-semibold tabular-nums">
          {patient.room || '—'}
          {patient.bed ? `/${patient.bed}` : ''}
        </span>
        <span className="min-w-0 truncate">{patient.name || patient.identity}</span>
        <Badges patient={patient} />
      </button>
      {placed && editable ? (
        <button
          type="button"
          aria-label={`Lepas ${label} dari papan`}
          title="Lepas"
          onClick={onReturn}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-bg-subtle hover:text-fg"
        >
          <IconClose width={14} height={14} />
        </button>
      ) : null}
    </li>
  );
}
