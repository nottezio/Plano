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
import { IconMore } from '@/components/common/Icons';
import { NewDot, SoapBadge } from './SoapBadge';
import { PatientControls } from './PatientControls';
import { ListMessage } from './ListMessage';
import { ManualPatientSheet } from './ManualPatientSheet';
import { PasteFloat } from './PasteFloat';
import { DischargeChip, FLAG_TEXT } from './DischargeChip';

/**
 * The list's columns from 1024 px (12 Nov 2026): one table row per patient, so the
 * full width is used. Below 1024 px the same cells read as two lines.
 */
const COLUMNS = 'lg:grid-cols-[4.5rem_minmax(0,2.2fr)_3.5rem_6.5rem_3.5rem_minmax(0,1fr)_minmax(0,1fr)]';

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
  /*
    The WhatsApp preview opens beside the list on a desk (12 Nov 2026). It was a folded box in a
    24 rem column of its own, which left a third of a wide screen empty beside the list.
  */
  const [previewOpen, setPreviewOpen] = useState(false);
  // Tempel over the list (2026-10-16; back in 12.3 after 12.1 dropped it).
  const [pasteOpen, setPasteOpen] = useState(false);
  const [editing, setEditing] = useState<FloorPatient | null>(null);
  const chiefs = chiefsOf(floor.chiefs);
  const byKey = useMemo(() => new Map(roster.map((p) => [p.key, p])), [roster]);
  const text = useMemo(() => buildFloorList(view.active, { ward: floor.ward, date, time, trioFullSoap: floor.trioFullSoap }), [view.active, floor.ward, date, time, floor.trioFullSoap]);
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
  const fresh = all.filter((p) => p.newBadge);
  const side = previewOpen || gone.length > 0;

  return (
    <div className={side ? 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]' : ''}>
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-faint">
            Di lantai ({words.length > 0 ? `${sorted.length} dari ${all.length}` : all.length})
          </h3>
          {fresh[0]?.newBadge ? (
            <span className="inline-flex items-center text-xs text-fg-muted">
              <NewDot label={fresh[0].newBadge.label} color={markCss(fresh[0].newBadge.color)} />
              <span className="ml-1.5 tabular-nums">
                {fresh.length} {fresh[0].newBadge.label.toLowerCase()}
              </span>
            </span>
          ) : null}
          <span className="flex-1" />
          <Button size="sm" variant={previewOpen ? 'primary' : 'secondary'} onClick={() => setPreviewOpen((v) => !v)} aria-pressed={previewOpen}>
            <span>
              Pratinjau<span className="max-sm:hidden"> WhatsApp</span>
            </span>
          </Button>
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
              <span>
                +<span className="max-sm:hidden"> Pasien</span> manual
              </span>
            </Button>
          ) : null}
        </div>
        {pasteOpen && editable ? <PasteFloat floor={floor} roster={roster} myName={myName} onClose={() => setPasteOpen(false)} /> : null}
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
          {sorted.length > 0 ? (
            <li aria-hidden="true" className="hidden bg-bg-subtle py-1.5 pl-3 pr-12 text-[11px] font-semibold uppercase tracking-wide text-fg-faint lg:block">
              <span className={`grid gap-x-3 ${COLUMNS}`}>
                <span>Kamar</span>
                <span>Pasien</span>
                <span>Umur</span>
                <span>RM</span>
                <span>DPJP</span>
                <span>Residen</span>
                <span>Catatan</span>
              </span>
            </li>
          ) : null}
          {sorted.map((patient) => {
            const entry = byKey.get(patient.key);
            if (!entry) return null;
            const isOpen = openKey === patient.key;
            return (
              <li key={patient.key}>
                <div className="flex items-center gap-1 py-1 pl-3 pr-1 lg:py-0">
                  <button type="button" onClick={() => onOpen(patient)} title={patient.identity} className="min-w-0 flex-1 py-1 text-left lg:py-0">
                    <PatientRowText patient={patient} />
                  </button>
                  {editable ? (
                    <Button
                      size="icon"
                      variant={isOpen ? 'secondary' : 'ghost'}
                      aria-expanded={isOpen}
                      aria-label={`Atur ${patient.name}`}
                      title="Atur status, residen, warna"
                      onClick={() => setOpenKey(isOpen ? null : patient.key)}
                      className="shrink-0 text-fg-muted"
                    >
                      <IconMore width={18} height={18} />
                    </Button>
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
      {side ? (
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

        {previewOpen ? (
          <section aria-label="Pratinjau pesan WhatsApp" className="rounded-xl border border-border bg-surface">
            <h3 className="px-3 py-2 text-xs font-semibold">Pratinjau pesan WhatsApp</h3>
            <div className="border-t border-border">
              <ListMessage text={text} />
            </div>
          </section>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}

/** The age written in the identity line ("58 tahun", "63 th"), for the row; '' when there is none. */
export function ageOf(identity: string): string {
  const m = /(?:^|[\s/])(\d{1,3})\s*(?:tahun|thn|th)\b/i.exec(identity);
  return m ? `${m[1]} th` : '';
}

/** " · " between the bits of the second line; gone from 1024 px, where each bit is a column. */
const DOT = (
  <span aria-hidden="true" className="text-fg-faint lg:hidden">
    {' · '}
  </span>
);

/**
 * A patient as a person reads them (12 Nov 2026, Avi: "non-human UI"): place, name and age on the
 * first line; RM, DPJP code, residents and notes muted below. The identity line was shown as
 * written ("Tn. X/08-02-1963/63 tahun/RM 1800954"), which wrapped to two bold lines on a phone and
 * buried the name. The stored identity is untouched: it is the row's tooltip and stays whole in the
 * SOAP the row opens. From 1024 px the same cells are table columns.
 */
function PatientRowText({ patient }: { patient: FloorPatient }): JSX.Element {
  const colour = patient.discharge ? FLAG_TEXT[patient.discharge] : undefined;
  const code = dpjpCodeOf(patient);
  const residents = [patient.junior, patient.chief].filter(Boolean).map((n) => `dr. ${n}`).join(' / ');
  const age = ageOf(patient.identity);
  const notes = [
    patient.btkv ? 'KJS BTKV' : '',
    patient.division ? `${holderLabel(patient.division)} · tidak di-FU` : '',
    patient.operkan ? `operkan → dr. ${patient.operkan.replace(/^dr\.?\s*/i, '')}` : '',
    patient.gantiChief ? `ganti chief → dr. ${patient.gantiChief.replace(/^dr\.?\s*/i, '')}` : '',
  ].filter(Boolean);
  const tags = patient.tags ?? [];
  return (
    <span className={`grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-x-2.5 text-cbody lg:min-h-11 lg:gap-x-3 ${COLUMNS}`}>
      <span className="row-span-2 self-center rounded bg-bg-subtle px-1 py-0.5 text-center text-xs font-semibold tabular-nums lg:row-span-1 lg:justify-self-start lg:bg-transparent lg:px-0 lg:text-left">
        {patient.room || '—'}
        {patient.bed ? `/${patient.bed}` : ''}
      </span>
      <span className="flex min-w-0 items-center gap-1 lg:contents">
        {/*
          The name first and never cut (12 Nov 2026, build 12.4, Avi): the chips could not
          shrink, so a narrow column cut the name to "T..". Now the cell wraps and the
          chips drop under the name when there is no room beside it.
        */}
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 lg:py-1.5">
          <span className="min-w-0 break-words font-semibold" style={colour ? { color: colour } : undefined}>
            {patient.name || patient.identity}
          </span>
          <DischargeChip patient={patient} />
          <span className="flex shrink-0 items-center">
            <SoapBadge patient={patient} />
          </span>
        </span>
        {age ? (
          <span className="shrink-0 text-fg-muted">
            <span aria-hidden="true" className="lg:hidden">
              ·{' '}
            </span>
            {age}
          </span>
        ) : (
          <span className="hidden lg:block" />
        )}
      </span>
      {/* lg:whitespace-normal (12.6): `truncate`'s nowrap is inherited through `contents`, so the residents ran into the next column. */}
      <span className="truncate text-xs text-fg-muted lg:contents lg:whitespace-normal">
        <span className="tabular-nums lg:truncate">{patient.rm ? `RM ${patient.rm}` : ''}</span>
        {patient.rm && code ? DOT : null}
        <span className="font-semibold lg:truncate">{code}</span>
        {code || patient.rm ? DOT : null}
        {/* Residents wrap on the desk table (build 12.5): truncated, the chief read "dr. Avi / dr. ...". */}
        <span className="min-w-0 lg:break-words">{residents || <span className="text-fg-faint">belum ada residen</span>}</span>
        <span className="lg:flex lg:min-w-0 lg:flex-wrap lg:items-center lg:gap-1">
          {notes.map((n, i) => (
            <span key={n}>
              {i === 0 ? DOT : <span aria-hidden="true">{' · '}</span>}
              {n}
            </span>
          ))}
          {tags.map((tag) => (
            <span
              key={tag.label}
              className="ml-1 inline-block rounded-full border px-1.5 text-[11px] font-semibold lg:ml-0"
              style={{ borderColor: markCss(tag.color), color: markCss(tag.color) }}
            >
              {tag.label}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}
