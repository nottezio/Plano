import { useMemo, useState } from 'react';

import { Button } from '@/components/common/ui';
import { removeManual, writeEdit } from '@/data/repositories/floors.repo';
import { ManualPatientSheet } from './ManualPatientSheet';
import { formatDmy } from '@/domain/dateDmy';
import { buildFloorList, byRoute, patientLine } from '@/domain/floorList/build';
import type { DayView, FloorDay } from '@/domain/floorList/floor';
import type { FloorPatient } from '@/domain/floorList/report';
import { copyText } from '@/lib/clipboard';

const FLAG_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ['', 'Dari plan'],
  ['none', '—'],
  ['tomorrow', 'H-1 (merah)'],
  ['today', 'Pulang (hijau)'],
];

/**
 * List (12.8): the message to send, and the corrections before sending —
 * residents, red/green, off the list, back on the list. Edits belong to the
 * day (`days/<date>.edits.<key>`) and survive every re-paste.
 */
export function ListPanel({
  floorId,
  ward,
  date,
  day,
  view,
  editable,
  onOpen,
  myName,
}: {
  floorId: string;
  ward: string;
  date: string;
  day: FloorDay;
  view: DayView;
  editable: boolean;
  onOpen: (patient: FloorPatient) => void;
  myName: string;
}): JSX.Element {
  const [copied, setCopied] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [editing, setEditing] = useState<FloorPatient | null>(null);
  const openManual = (patient: FloorPatient | null): void => {
    setEditing(patient);
    setManualOpen(true);
  };
  const text = useMemo(
    () => buildFloorList(view.present, { ward, date, time: day.time }),
    [view.present, ward, date, day.time],
  );
  const sorted = [...view.present].sort(byRoute(ward));
  const edit = (key: string, fields: Record<string, string | boolean | null>): void => {
    void writeEdit(floorId, date, key, fields);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="flex-1 text-xs font-semibold uppercase tracking-wide text-fg-faint">
            Pasien ({view.present.length})
          </h3>
          {editable ? (
            <Button size="sm" onClick={() => openManual(null)}>
              + Pasien manual (pediatri)
            </Button>
          ) : null}
        </div>
        <ManualPatientSheet
          open={manualOpen}
          onOpenChange={setManualOpen}
          floorId={floorId}
          ward={ward}
          date={date}
          myName={myName}
          editing={editing}
        />
        {sorted.length === 0 ? <p className="text-xs text-fg-muted">Belum ada laporan untuk tanggal ini. Buka Tempel.</p> : null}
        <ul className="space-y-2">
          {sorted.map((patient) => {
            const e = day.edits[patient.key] ?? {};
            return (
              <li key={patient.key} className="rounded-xl border border-border bg-surface p-2 text-xs">
                <button type="button" onClick={() => onOpen(patient)} className="block text-left font-semibold hover:underline">
                  {patientLine(patient)}
                </button>
                <p className="mt-0.5 text-[11px] text-fg-faint">
                  {patient.manual ? 'Diinput manual' : 'Laporan'}{' '}
                  {patient.sentAt ? `${formatDmy(patient.sentAt.slice(0, 10))} ${patient.sentAt.slice(11, 16)}` : '—'}
                  {patient.body ? '' : ' · tanpa Diagnosis/Terapi'}
                </p>
                {editable ? (
                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    <input
                      key={`j-${e.junior ?? ''}`}
                      aria-label={`Junior ${patient.name}`}
                      defaultValue={e.junior ?? ''}
                      placeholder={`Junior: ${patient.junior || '—'}`}
                      onBlur={(event) => edit(patient.key, { junior: event.target.value.trim() || null })}
                      className="min-h-tap rounded-lg border border-border bg-surface px-2"
                    />
                    <input
                      key={`c-${e.chief ?? ''}`}
                      aria-label={`Chief ${patient.name}`}
                      defaultValue={e.chief ?? ''}
                      placeholder={`Chief: ${patient.chief || '—'}`}
                      onBlur={(event) => edit(patient.key, { chief: event.target.value.trim() || null })}
                      className="min-h-tap rounded-lg border border-border bg-surface px-2"
                    />
                    <select
                      aria-label={`Status pulang ${patient.name}`}
                      value={e.discharge ?? ''}
                      onChange={(event) => edit(patient.key, { discharge: event.target.value || null })}
                      className="min-h-tap rounded-lg border border-border bg-surface px-2"
                    >
                      {FLAG_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" onClick={() => edit(patient.key, { hidden: true })}>
                      Keluarkan
                    </Button>
                    {patient.manual ? (
                      <>
                        <Button size="sm" onClick={() => openManual(patient)}>
                          Ubah isi
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => void removeManual(floorId, patient.key)}>
                          Hapus pasien manual
                        </Button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        {view.gone.length > 0 || view.hidden.length > 0 ? (
          <div className="space-y-1 rounded-xl border border-dashed border-border p-2 text-xs">
            <p className="font-semibold">Tidak masuk list</p>
            {view.gone.map(({ patient, reason }) => (
              <div key={patient.key} className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => onOpen(patient)} className="min-w-0 flex-1 text-left hover:underline">
                  {patient.room} {patient.name} —{' '}
                  {reason === 'pulang' ? 'pulang (dari plan)' : `tidak ada laporan sejak ${formatDmy(patient.sentAt.slice(0, 10))}`}
                </button>
                {editable ? (
                  <Button size="sm" onClick={() => edit(patient.key, { keep: true })}>
                    Masukkan
                  </Button>
                ) : null}
              </div>
            ))}
            {view.hidden.map((patient) => (
              <div key={patient.key} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1">
                  {patient.room} {patient.name} — dikeluarkan manual
                </span>
                {editable ? (
                  <Button size="sm" onClick={() => edit(patient.key, { hidden: null })}>
                    Masukkan
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="flex-1 text-xs font-semibold uppercase tracking-wide text-fg-faint">Pesan List Pasien</h3>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              void copyText(text).then((ok) => setCopied(ok));
            }}
          >
            {copied ? 'Tersalin' : 'Salin'}
          </Button>
        </div>
        <pre className="max-h-[70dvh] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-bg-subtle p-3 font-sans text-xs leading-relaxed">
          {text}
        </pre>
      </div>
    </div>
  );
}
