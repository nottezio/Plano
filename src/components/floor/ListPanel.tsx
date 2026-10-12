import { useMemo, useState } from 'react';

import { DateField } from '@/components/common/DateField';
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
  suggestionFor,
  type ColourMark,
  type Edition,
  type FloorDoc,
  type RosterPatient,
  type RosterView,
  type StatusChange,
} from '@/domain/floorList/floor';
import type { FloorPatient } from '@/domain/floorList/report';
import { copyText } from '@/lib/clipboard';
import { deliverFile } from '@/lib/download';
import { ManualPatientSheet } from './ManualPatientSheet';

const COLOUR_OPTIONS: ReadonlyArray<readonly [ColourMark, string]> = [
  ['none', 'Tanpa warna'],
  ['h1', 'H-1 (merah)'],
  ['today', 'Pulang hari ini (hijau)'],
];
const PINDAH_CHIPS = ['ICU', 'CVCU', 'HCU', 'ICCU', 'Lantai lain'];

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
}: {
  floor: FloorDoc;
  roster: readonly RosterPatient[];
  view: RosterView;
  date: string;
  editable: boolean;
  onOpen: (patient: FloorPatient) => void;
  myName: string;
  editions: readonly Edition[];
}): JSX.Element {
  const [copied, setCopied] = useState('');
  const [time, setTime] = useState(() => defaultTime(new Date()));
  const [saved, setSaved] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [editing, setEditing] = useState<FloorPatient | null>(null);
  const [pindahFor, setPindahFor] = useState<string | null>(null);
  const [pindahTo, setPindahTo] = useState('');
  const chiefs = chiefsOf(floor.chiefs);
  const byKey = useMemo(() => new Map(roster.map((p) => [p.key, p])), [roster]);
  const text = useMemo(() => buildFloorList(view.active, { ward: floor.ward, date, time }), [view.active, floor.ward, date, time]);
  const sorted = [...view.active].sort(byRoute(floor.ward));
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
            Di lantai ({view.active.length})
          </h3>
          {editable ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setManualOpen(true);
              }}
            >
              + Pasien manual (pediatri)
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
        <datalist id="floor-chiefs">
          {chiefs.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        {chiefs.length > 1 && sorted.some((p) => !p.chief) ? (
          <p className="text-xs text-fg-muted">{sorted.filter((p) => !p.chief).length} pasien belum ada chief — pilih di kolom Chief.</p>
        ) : null}
        {sorted.length === 0 ? <p className="text-xs text-fg-muted">Belum ada pasien. Buka Tempel.</p> : null}

        <ul className="space-y-2">
          {sorted.map((patient) => {
            const entry = byKey.get(patient.key);
            if (!entry) return null;
            const suggestion = suggestionFor(entry, date);
            return (
              <li key={patient.key} className="rounded-xl border border-border bg-surface p-2 text-xs">
                <button type="button" onClick={() => onOpen(patient)} className="block text-left font-semibold hover:underline">
                  {patientLine(patient)}
                </button>
                <p className="mt-0.5 text-[11px] text-fg-faint">
                  {patient.manual ? 'Diinput manual' : 'Laporan'}{' '}
                  {patient.sentAt ? `${formatDmy(patient.sentAt.slice(0, 10))} ${patient.sentAt.slice(11, 16)}` : '—'}
                  {patient.body ? '' : ' · tanpa Diagnosis/Terapi'}
                  {entry.dischargeDate ? ` · rencana pulang ${formatDmy(entry.dischargeDate)}` : ''}
                </p>

                {suggestion && editable ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-lg bg-bg-subtle px-2 py-1">
                    <span className="flex-1">
                      Plan menyebut <strong>{suggestion === 'h1' ? 'H-1' : 'pulang hari ini'}</strong>. Tandai?
                    </span>
                    <Button size="sm" onClick={() => set(patient.key, { colour: suggestion }, suggestion === 'h1' ? 'H-1 (dari saran Plan)' : 'Pulang hari ini (dari saran Plan)')}>
                      Tandai
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => set(patient.key, { dismissed: patient.sentAt })}>
                      Abaikan
                    </Button>
                  </div>
                ) : null}

                {editable ? (
                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    <input
                      key={`j-${entry.junior}`}
                      aria-label={`Junior ${patient.name}`}
                      defaultValue={entry.junior}
                      placeholder={`Junior: ${patient.junior || '—'}`}
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        if (next !== entry.junior) set(patient.key, { junior: next });
                      }}
                      className={`${INPUT} text-xs`}
                    />
                    <input
                      key={`c-${entry.chief}`}
                      aria-label={`Chief ${patient.name}`}
                      defaultValue={entry.chief}
                      list="floor-chiefs"
                      placeholder={`Chief: ${patient.chief || (chiefs.length > 1 ? 'pilih' : '—')}`}
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        if (next !== entry.chief) set(patient.key, { chief: next });
                      }}
                      className={`${INPUT} text-xs`}
                    />
                    <select
                      aria-label={`Warna ${patient.name}`}
                      value={entry.colour}
                      onChange={(e) => {
                        const next = e.target.value as ColourMark;
                        set(patient.key, { colour: next }, COLOUR_OPTIONS.find(([v]) => v === next)?.[1] ?? next);
                      }}
                      className={`${INPUT} text-xs`}
                    >
                      {COLOUR_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <DateField
                      value={entry.dischargeDate}
                      allowEmpty
                      ariaLabel={`Rencana pulang ${patient.name}`}
                      onChange={(next) => set(patient.key, { dischargeDate: next }, next ? `Rencana pulang ${formatDmy(next)}` : 'Rencana pulang dihapus')}
                      className="w-full"
                    />
                    <Button size="sm" onClick={() => set(patient.key, { status: 'pulang', leftAt: new Date().toISOString() }, 'Pulang')}>
                      Pulang
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setPindahFor(pindahFor === patient.key ? null : patient.key);
                        setPindahTo('');
                      }}
                    >
                      Pindah…
                    </Button>
                    {patient.manual ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditing(patient);
                          setManualOpen(true);
                        }}
                      >
                        Ubah isi
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                {pindahFor === patient.key ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {PINDAH_CHIPS.map((chip) => (
                      <Button key={chip} size="sm" variant={pindahTo === chip ? 'primary' : 'secondary'} onClick={() => setPindahTo(chip)}>
                        {chip}
                      </Button>
                    ))}
                    <input
                      value={pindahTo}
                      onChange={(e) => setPindahTo(e.target.value)}
                      placeholder="Tujuan"
                      aria-label="Tujuan pindah"
                      className={`${INPUT} w-32 text-xs`}
                    />
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={!pindahTo.trim()}
                      onClick={() => {
                        set(patient.key, { status: 'pindah', pindahKe: pindahTo.trim(), leftAt: new Date().toISOString() }, `Pindah ke ${pindahTo.trim()}`);
                        setPindahFor(null);
                      }}
                    >
                      Simpan pindah
                    </Button>
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

        <pre className="max-h-[70dvh] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-bg-subtle p-3 font-sans text-xs leading-relaxed">
          {text}
        </pre>
      </div>
    </div>
  );
}
