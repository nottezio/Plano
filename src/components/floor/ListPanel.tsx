import { useMemo, useState } from 'react';

import { Button } from '@/components/common/ui';
import { writeRosterFields } from '@/data/repositories/floors.repo';
import { formatDmy } from '@/domain/dateDmy';
import { buildFloorList, byRoute, dpjpCodeOf, patientLine } from '@/domain/floorList/build';
import {
  chiefsOf,
  leftNote,
  holderLabel,
  leftSince,
  localOf,
  type Edition,
  type FloorDoc,
  type RosterPatient,
  type RosterView,
  type StatusChange,
} from '@/domain/floorList/floor';
import { markCss } from '@/domain/floorList/marks';
import type { FloorPatient } from '@/domain/floorList/report';
import { matchesSearch } from '@/domain/floorList/search';
import { copyText } from '@/lib/clipboard';
import { SoapBadge } from './SoapBadge';
import { PatientControls } from './PatientControls';
import { ListMessage } from './ListMessage';
import { ManualPatientSheet } from './ManualPatientSheet';
import { PasteFloat } from './PasteFloat';
import { DischargeChip, FLAG_TEXT } from './DischargeChip';

/**
 * List (12.12): the roster on this list date, with every decision by hand —
 * residents, colour (or a planned discharge date), Pulang / Pindah — each
 * logged and undoable; SOAP suggestions as chips; the message preview and
 * the separate Pulang/Pindah note. Salin teks, Cetak and Simpan edisi sit
 * with the tabs on every tab (`ListActions`, 10 Nov 2026).
 */
export function ListPanel({
  floor,
  roster,
  view,
  date,
  editable,
  onOpen,
  myName,
  editions,
  time,
  words = [],
}: {
  floor: FloorDoc;
  roster: readonly RosterPatient[];
  view: RosterView;
  date: string;
  editable: boolean;
  onOpen: (patient: FloorPatient) => void;
  myName: string;
  editions: readonly Edition[];
  /** The Jam list, set in Simpan edisi; heads the message preview. */
  time: string;
  /** The page's search (13.7): only matching cards are shown. */
  words?: readonly string[];
}): JSX.Element {
  const [copied, setCopied] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  // Tempel over the list (2026-10-16).
  const [pasteOpen, setPasteOpen] = useState(false);
  const [editing, setEditing] = useState<FloorPatient | null>(null);
  const chiefs = chiefsOf(floor.chiefs);
  const byKey = useMemo(() => new Map(roster.map((p) => [p.key, p])), [roster]);
  const text = useMemo(() => buildFloorList(view.active, { ward: floor.ward, date, time }), [view.active, floor.ward, date, time]);
  const all = [...view.active].sort(byRoute(floor.ward));
  const sorted = words.length > 0 ? all.filter((p) => matchesSearch(p, words)) : all;
  const lastEdition = editions[0];
  const gone = leftSince(roster, lastEdition?.createdAt ?? '');
  const note = leftNote(gone, patientLine);

  const stamp = (what: string): StatusChange => ({ at: new Date().toISOString(), by: myName, what });
  const set = (key: string, fields: Parameters<typeof writeRosterFields>[2], what?: string): void => {
    void writeRosterFields(floor.id, key, fields, what ? stamp(what) : undefined);
  };
  const copy = (value: string, label: string): void => {
    void copyText(value).then((ok) => setCopied(ok ? label : ''));
  };

  /** The one patient whose controls are open (13.15). */
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="flex-1 text-xs font-semibold uppercase tracking-wide text-fg-faint">
            Di lantai ({words.length > 0 ? `${sorted.length} dari ${all.length}` : all.length})
          </h3>
          {editable ? (
            <Button size="sm" variant={pasteOpen ? 'primary' : 'secondary'} onClick={() => setPasteOpen((v) => !v)} aria-pressed={pasteOpen}>
              Tempel
            </Button>
          ) : null}
          {editable ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setManualOpen(true);
              }}
            >
              + Pasien manual
            </Button>
          ) : null}
          {pasteOpen && editable ? <PasteFloat floor={floor} roster={roster} myName={myName} onClose={() => setPasteOpen(false)} /> : null}
        </div>
        <ManualPatientSheet
          open={manualOpen}
          onOpenChange={setManualOpen}
          floorId={floor.id}
          ward={floor.ward}
          date={date}
          myName={myName}
          editing={editing}
          roster={roster}
        />
        {chiefs.length > 1 && sorted.some((p) => !p.chief && !p.division) ? (
          <p className="text-xs text-fg-muted">{sorted.filter((p) => !p.chief && !p.division).length} pasien belum ada chief — buka Atur pada pasiennya.</p>
        ) : null}
        {all.length === 0 ? <p className="text-xs text-fg-muted">Belum ada pasien. Buka Tempel.</p> : null}
        {all.length > 0 && sorted.length === 0 ? <p className="text-xs text-fg-muted">Tidak ada pasien yang cocok.</p> : null}

        {/*
          A list to READ (13.15, Avi: "too many buttons, a headache to see"):
          one compact row per patient — place, DPJP, identity, residents,
          marks — and ONE "Atur" that opens that patient's controls. Tapping
          the row opens the SOAP, as on the denah.
        */}
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {sorted.map((patient) => {
            const entry = byKey.get(patient.key);
            if (!entry) return null;
            const isOpen = openKey === patient.key;
            return (
              <li key={patient.key}>
                <div className="flex items-start gap-3 py-d-row pl-3 pr-2">
                  <button type="button" onClick={() => onOpen(patient)} className="min-w-0 flex-1 text-left">
                    <PatientRowText patient={patient} />
                  </button>
                  {editable ? (
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-label={`Atur ${patient.name}`}
                      onClick={() => setOpenKey(isOpen ? null : patient.key)}
                      className={`min-h-tap min-w-[4.5rem] shrink-0 rounded-lg border px-3 text-xs font-semibold [@media(pointer:fine)]:min-h-8 ${
                        isOpen ? 'border-accent bg-[var(--accent-soft)] text-accent' : 'border-border text-fg-muted hover:text-fg'
                      }`}
                    >
                      Atur {isOpen ? '▴' : '▾'}
                    </button>
                  ) : null}
                </div>
                {isOpen && editable ? (
                  <div className="border-t border-border bg-bg-subtle px-3 py-2">
                    <PatientControls
                      floor={floor}
                      entry={entry}
                      patient={patient}
                      date={date}
                      myName={myName}
                      allowDelete
                      onGone={() => setOpenKey(null)}
                      onEditManual={(p) => {
                        setEditing(p);
                        setManualOpen(true);
                      }}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        {view.left.length > 0 ? (
          <details className="rounded-xl border border-dashed border-border p-2 text-xs">
            <summary className="cursor-pointer font-semibold">Sudah keluar ({view.left.length})</summary>
            <ul className="mt-1 space-y-1">
              {view.left.map((p) => (
                <li key={p.key} className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => onOpen(p.report)} className="min-w-0 flex-1 text-left hover:underline">
                    {p.report.room} {p.report.name} — {p.status === 'pindah' ? `pindah ke ${p.pindahKe}` : 'pulang'}
                    {p.leftAt ? ` · ${formatDmy(localOf(p.leftAt).slice(0, 10))} ${localOf(p.leftAt).slice(11, 16)}` : ''}
                    {p.log.at(-1)?.by ? ` · ${p.log.at(-1)!.by}` : ''}
                  </button>
                  {editable ? (
                    <Button size="sm" onClick={() => set(p.key, { status: 'dirawat', leftAt: '', pindahKe: '' }, 'Dikembalikan ke list')}>
                      Kembalikan
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      {/* Pinned under the sub-tab bar (`sticky top-0`; its measured height is `--lm-tabs-h`), not behind it; a tall panel scrolls inside itself so its bottom is reachable. */}
      <div className="min-w-0 space-y-3 lg:sticky lg:top-[calc(var(--lm-tabs-h,4.5rem)+0.5rem)] lg:max-h-[calc(var(--app-h,100dvh)-var(--lm-tabs-h,4.5rem)-1rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain">
        {gone.length > 0 ? (
          <div className="space-y-1 rounded-xl border border-border bg-surface p-3 text-xs">
            <div className="flex items-center gap-2">
              <p className="flex-1 font-semibold">
                Catatan pulang / pindah{lastEdition ? ` sejak edisi ${formatDmy(lastEdition.date)} ${lastEdition.time}` : ''}
              </p>
              <Button size="sm" onClick={() => copy(note, 'note')}>
                {copied === 'note' ? 'Tersalin' : 'Salin'}
              </Button>
            </div>
            <pre className="whitespace-pre-wrap break-words font-sans">{note}</pre>
          </div>
        ) : null}

        <details className="rounded-xl border border-border bg-surface">
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">Pratinjau pesan WhatsApp</summary>
          <div className="border-t border-border">
            <ListMessage text={text} />
          </div>
        </details>
      </div>
    </div>
  );
}

/**
 * A patient as one easy line: place and DPJP code as small chips, the
 * identity (red/green when H-1 / pulang), then residents and marks below.
 */
function PatientRowText({ patient }: { patient: FloorPatient }): JSX.Element {
  const colour = patient.discharge ? FLAG_TEXT[patient.discharge] : undefined;
  const code = dpjpCodeOf(patient);
  const residents = [patient.junior, patient.chief].filter(Boolean).map((n) => `dr. ${n}`).join(' / ');
  const notes = [
    patient.btkv ? 'KJS BTKV' : '',
    patient.division ? `${holderLabel(patient.division)} · tidak di-FU` : '',
    patient.operkan ? `operkan → dr. ${patient.operkan.replace(/^dr\.?\s*/i, '')}` : '',
    patient.gantiChief ? `ganti chief → dr. ${patient.gantiChief.replace(/^dr\.?\s*/i, '')}` : '',
  ].filter(Boolean);
  return (
    <span className="block text-cbody">
      <span className="mr-1 inline-block rounded bg-bg-subtle px-1.5 font-semibold tabular-nums">
        {patient.room || '—'}
        {patient.bed ? `/${patient.bed}` : ''}
      </span>
      {code ? <span className="mr-1 inline-block rounded border border-border px-1 text-[11px] font-semibold text-fg-muted">{code}</span> : null}
      {/* A word, not a stripe down the row's edge: the colour was already on the identity. */}
      {patient.discharge ? (
        <span className="mr-1">
          <DischargeChip patient={patient} />
        </span>
      ) : null}
      <span className="font-semibold" style={colour ? { color: colour } : undefined}>
        {patient.identity}
      </span>
      <span className="mt-0.5 block text-xs text-fg-muted">
        {residents || <span className="text-fg-faint">belum ada residen</span>}
        {notes.map((n) => (
          <span key={n}> · {n}</span>
        ))}
        <SoapBadge patient={patient} />
        {(patient.tags ?? []).map((tag) => (
          <span
            key={tag.label}
            className="ml-1 inline-block rounded-full border px-1.5 text-[11px] font-semibold"
            style={{ borderColor: markCss(tag.color), color: markCss(tag.color) }}
          >
            {tag.label}
          </span>
        ))}
      </span>
    </span>
  );
}
