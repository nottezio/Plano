import { useMemo, useState } from 'react';

import { Button, Callout, INPUT } from '@/components/common/ui';
import { saveEdition, writeRosterFields } from '@/data/repositories/floors.repo';
import { formatDmy } from '@/domain/dateDmy';
import { buildFloorList, byRoute, patientLine } from '@/domain/floorList/build';
import { buildDenahDocx, buildListDocx, DOCX_MIME, floorFileName } from '@/domain/floorList/docx';
import { wardPlan } from '@/domain/denahPlan';
import {
  chiefsOf,
  leftNote,
  leftSince,
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
import { deliverFile } from '@/lib/download';
import { DeletePatient } from './DeletePatient';
import { SoapBadge } from './SoapBadge';
import { PatientControls } from './PatientControls';
import { ListMessage } from './ListMessage';
import { ManualPatientSheet } from './ManualPatientSheet';


/** The patient card's tint by its colour on this list (12.12): red H-1, green pulang hari ini. */
const FLAG_TEXT = { tomorrow: 'var(--note-red)', today: 'var(--note-green)' } as const;

/** Red/green tint the card; a floor tag only colours its own chip (13.10). */
function cardColour(patient: FloorPatient): string | null {
  return patient.discharge ? FLAG_TEXT[patient.discharge] : null;
}
const tinted = (colour: string) => ({
  borderColor: colour,
  borderLeftWidth: 4,
  backgroundColor: `color-mix(in srgb, ${colour} 8%, var(--surface))`,
});

/** A prefill only (free text): the usual send times of the floor. */
function defaultTime(now: Date): string {
  const h = now.getHours();
  return h < 10 ? '04.00' : h < 18 ? '16.00' : '19.00';
}

/**
 * List (12.12): the roster on this list date, with every decision by hand —
 * residents, colour (or a planned discharge date), Pulang / Pindah — each
 * logged and undoable; SOAP suggestions as chips; the message; "Simpan
 * edisi" with a free-text time; and the separate Pulang/Pindah note.
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
  /** The page's search (13.7): only matching cards are shown. */
  words?: readonly string[];
}): JSX.Element {
  const [copied, setCopied] = useState('');
  const [time, setTime] = useState(() => defaultTime(new Date()));
  const [saved, setSaved] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
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

  const saveThisEdition = async (): Promise<void> => {
    await saveEdition(floor.id, {
      date,
      time: time.trim() || '—',
      text,
      patients: view.active,
      createdAt: new Date().toISOString(),
      createdBy: myName,
    });
    setSaved(`Edisi ${formatDmy(date)} ${time} tersimpan.`);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="flex-1 text-xs font-semibold uppercase tracking-wide text-fg-faint">
            Di lantai ({words.length > 0 ? `${sorted.length} dari ${all.length}` : all.length})
          </h3>
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
        </div>
        <ManualPatientSheet
          open={manualOpen}
          onOpenChange={setManualOpen}
          floorId={floor.id}
          ward={floor.ward}
          date={date}
          myName={myName}
          editing={editing}
        />
        {chiefs.length > 1 && sorted.some((p) => !p.chief && !p.division) ? (
          <p className="text-xs text-fg-muted">{sorted.filter((p) => !p.chief && !p.division).length} pasien belum ada chief — pilih di kolom Chief.</p>
        ) : null}
        {all.length === 0 ? <p className="text-xs text-fg-muted">Belum ada pasien. Buka Tempel.</p> : null}
        {all.length > 0 && sorted.length === 0 ? <p className="text-xs text-fg-muted">Tidak ada pasien yang cocok.</p> : null}

        <ul className="space-y-2">
          {sorted.map((patient) => {
            const entry = byKey.get(patient.key);
            if (!entry) return null;
            const colour = cardColour(patient);
            return (
              <li key={patient.key} className="rounded-xl border border-border bg-surface p-2 text-xs" style={colour ? tinted(colour) : undefined}>
                <button
                  type="button"
                  onClick={() => onOpen(patient)}
                  className="block text-left font-semibold hover:underline"
                  style={colour ? { color: colour } : undefined}
                >
                  {patientLine(patient)}
                  {patient.discharge ? <span className="sr-only"> ({patient.discharge === 'tomorrow' ? 'H-1' : 'pulang hari ini'})</span> : null}
                  <SoapBadge patient={patient} />
                  {(patient.tags ?? []).map((tag) => (
                    <span
                      key={tag.label}
                      className="ml-1 inline-block rounded-full border px-1.5 text-[10px] font-semibold"
                      style={{ borderColor: markCss(tag.color), color: markCss(tag.color) }}
                    >
                      {tag.label}
                    </span>
                  ))}
                </button>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-1">
                  <p className="min-w-0 flex-1 text-[11px] text-fg-faint">
                    {patient.manual ? 'Diinput manual' : 'Laporan'}{' '}
                    {patient.sentAt ? `${formatDmy(patient.sentAt.slice(0, 10))} ${patient.sentAt.slice(11, 16)}` : '—'}
                    {patient.body ? '' : ' · tanpa Diagnosis/Terapi'}
                    {entry.dischargeDate ? ` · rencana pulang ${formatDmy(entry.dischargeDate)}` : ''}
                    {patient.division ? ` · dipegang divisi ${patient.division}, tidak di-FU` : ''}
                  </p>
                  {editable ? <DeletePatient floorId={floor.id} patientKey={patient.key} name={patient.name} compact /> : null}
                </div>
                {editable ? (
                  <PatientControls
                    floor={floor}
                    entry={entry}
                    patient={patient}
                    date={date}
                    myName={myName}
                    onEditManual={(p) => {
                      setEditing(p);
                      setManualOpen(true);
                    }}
                  />
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
                    {p.leftAt ? ` · ${formatDmy(p.leftAt.slice(0, 10))} ${p.leftAt.slice(11, 16)}` : ''}
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

      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="mb-1 block text-xs text-fg-muted">Jam list</span>
            <input value={time} onChange={(e) => setTime(e.target.value)} aria-label="Jam list" className={`${INPUT} w-28`} />
          </label>
          <span className="flex-1" />
          <Button size="sm" onClick={() => copy(text, 'list')}>
            {copied === 'list' ? 'Tersalin' : 'Salin'}
          </Button>
          <Button
            size="sm"
            onClick={() => void deliverFile(new Blob([buildListDocx(text)], { type: DOCX_MIME }), floorFileName('List Pasien', floor.ward, date))}
          >
            Word: List
          </Button>
          <Button
            size="sm"
            onClick={() =>
              void deliverFile(
                new Blob([buildDenahDocx({ ward: floor.ward, date, plan: wardPlan(floor.ward), patients: view.active })], { type: DOCX_MIME }),
                floorFileName('Denah', floor.ward, date),
              )
            }
          >
            Word: Denah
          </Button>
          {editable ? (
            <Button size="sm" variant="primary" onClick={() => void saveThisEdition()} disabled={view.active.length === 0}>
              Simpan edisi
            </Button>
          ) : null}
        </div>
        {saved ? <Callout title="Tersimpan">{saved} Lihat di tab Riwayat.</Callout> : null}

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

        <ListMessage text={text} />
      </div>
    </div>
  );
}
