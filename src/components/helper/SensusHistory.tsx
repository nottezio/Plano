import { useState } from 'react';

import { ScrollStrip } from '@/components/common/ScrollStrip';
import { Segmented } from '@/components/common/ui';
import { formatShortDate } from '@/domain/clinicalDate';
import { formatDmy } from '@/domain/dateDmy';
import {
  diffSnapshots,
  evolution,
  evolutionGrid,
  whereText,
  type Change,
  type CensusSnapshot,
  type SnapPatient,
} from '@/domain/census/evolution';
import { PLACE_LABEL } from '@/domain/census/maker';

/**
 * Riwayat — how the DPJP's census evolved, day by day (2026-10-10).
 *
 * Two readings of the same snapshots: Perubahan (what changed each day,
 * newest first) and Tabel (patients against days). Drawn only from days that
 * were copied or saved; a day nobody sent is simply absent, never "empty".
 */

const KIND: Record<Change['kind'], { mark: string; label: string; tone: string }> = {
  baru: { mark: '+', label: 'Baru', tone: 'text-accent' },
  keluar: { mark: '−', label: 'Keluar', tone: 'text-danger' },
  'tidak-dicek': { mark: '?', label: 'Tidak dicek', tone: 'text-fg-faint' },
  pindah: { mark: '⇄', label: 'Pindah', tone: 'text-[var(--warn-strong)]' },
  dx: { mark: '✎', label: 'Diagnosis', tone: 'text-fg-muted' },
};

function dayLabel(date: string): string {
  return `${formatShortDate(date).split(',')[0] ?? ''}, ${formatDmy(date)}`;
}

function counts(changes: readonly Change[]): string {
  const added = changes.filter((change) => change.kind === 'baru').length;
  const gone = changes.filter((change) => change.kind === 'keluar').length;
  return [added ? `+${added}` : '', gone ? `−${gone}` : ''].filter(Boolean).join(' / ');
}

export function ChangeRow({ change }: { change: Change }): JSX.Element {
  const kind = KIND[change.kind];
  const detail =
    change.kind === 'pindah'
      ? `${change.from} → ${change.to}`
      : change.kind === 'dx'
        ? [...change.added.map((line) => `+ ${line.replace(/^[-•*\s]+/, '')}`), ...change.removed.map((line) => `− ${line.replace(/^[-•*\s]+/, '')}`)].join(' · ')
        : change.kind === 'keluar'
          ? `${whereText(change.patient)} — tidak ada lagi di list`
          : change.kind === 'tidak-dicek'
            ? `${PLACE_LABEL[change.patient.place]} belum ditempel hari itu`
            : whereText(change.patient);
  return (
    <li className="flex gap-2 py-1">
      <span aria-hidden="true" className={`w-4 shrink-0 text-center font-semibold ${kind.tone}`}>
        {kind.mark}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`font-medium ${kind.tone}`}>{kind.label}</span> · {change.patient.name}
        {change.patient.kjs ? <span className="text-fg-faint"> ({change.patient.kjs})</span> : null}
        <span className="block text-[11px] leading-snug text-fg-muted">{detail}</span>
      </span>
    </li>
  );
}

/**
 * Today's census against the last day in the history, BEFORE it is sent:
 * the changes the resident is about to report, shown where the census is.
 */
export function ChangeSummary({
  current,
  previous,
}: {
  current: CensusSnapshot;
  previous: CensusSnapshot | null;
}): JSX.Element | null {
  if (!previous) return null;
  const changes = diffSnapshots(previous, current);
  return (
    <section aria-label="Dibanding hari sebelumnya" className="rounded-xl border border-border bg-surface px-3 py-2 text-xs">
      <p className="font-semibold">
        Dibanding {dayLabel(previous.date)}: {current.patients.length} pasien
        {counts(changes) ? ` (${counts(changes)})` : ''}
      </p>
      {changes.length === 0 ? (
        <p className="text-[11px] text-fg-muted">Tidak ada perubahan pasien, tempat, atau diagnosis.</p>
      ) : (
        <ul className="divide-y divide-border">
          {changes.map((change, index) => (
            <ChangeRow key={`${change.kind}-${change.patient.key}-${index}`} change={change} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function SensusHistory({ days, code }: { days: readonly CensusSnapshot[]; code: string }): JSX.Element {
  const [view, setView] = useState<'perubahan' | 'tabel'>('perubahan');

  if (days.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-fg-muted">
        Belum ada riwayat untuk {code}. Sensus hari ini masuk ke riwayat saat Anda menekan <b>Salin</b> atau{' '}
        <b>Simpan</b> — mulai besok, perubahannya tampil di sini.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-xs text-fg-muted">
          {days.length} hari tercatat · {dayLabel(days[0]!.date)} – {dayLabel(days[days.length - 1]!.date)}
        </p>
        <Segmented
          label="Tampilan riwayat"
          size="sm"
          value={view}
          onChange={setView}
          options={[
            ['perubahan', 'Perubahan'],
            ['tabel', 'Tabel'],
          ]}
        />
      </div>
      {view === 'perubahan' ? <ChangesView days={days} /> : <GridView days={days} />}
    </div>
  );
}

function ChangesView({ days }: { days: readonly CensusSnapshot[] }): JSX.Element {
  return (
    <ol className="space-y-2">
      {evolution(days).map((day) => (
        <li key={day.date} className="rounded-xl border border-border bg-surface px-3 py-2 text-xs">
          <p className="font-semibold">
            {dayLabel(day.date)} · {day.count} pasien
            {counts(day.changes) ? <span className="font-normal text-fg-muted"> ({counts(day.changes)})</span> : null}
          </p>
          {day.first ? (
            <p className="text-[11px] text-fg-muted">Awal riwayat.</p>
          ) : day.changes.length === 0 ? (
            <p className="text-[11px] text-fg-muted">Tidak ada perubahan.</p>
          ) : (
            <ul className="divide-y divide-border">
              {day.changes.map((change, index) => (
                <ChangeRow key={`${change.kind}-${change.patient.key}-${index}`} change={change} />
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

function cellTitle(cell: SnapPatient | null | 'unchecked', date: string): string {
  if (cell === 'unchecked') return `${formatDmy(date)}: list tempatnya belum ditempel`;
  if (!cell) return `${formatDmy(date)}: tidak ada`;
  return `${formatDmy(date)}: ${whereText(cell)}`;
}

function GridView({ days }: { days: readonly CensusSnapshot[] }): JSX.Element {
  const { dates, rows } = evolutionGrid(days);
  // The newest fortnight: wider than that is a scroll, and the summary column carries the rest.
  const shown = dates.slice(-14);
  const offset = dates.length - shown.length;
  return (
    <ScrollStrip outerClassName="rounded-xl border border-border bg-surface" fade="from-surface">
      <table className="w-full min-w-max border-collapse text-xs">
        <thead>
          <tr className="border-b border-border text-[10px] text-fg-faint">
            <th scope="col" className="sticky left-0 z-[1] bg-surface px-3 py-1.5 text-left font-medium">
              Pasien
            </th>
            {shown.map((date) => (
              <th key={date} scope="col" className="px-1 py-1.5 text-center font-medium tabular-nums">
                {date.slice(8)}/{date.slice(5, 7)}
              </th>
            ))}
            <th scope="col" className="px-3 py-1.5 text-left font-medium">
              Lama · tempat
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={`border-b border-border last:border-b-0 ${row.current ? '' : 'text-fg-faint'}`}>
              <th scope="row" className="sticky left-0 z-[1] max-w-[11rem] truncate bg-surface px-3 py-1 text-left font-medium">
                {row.name}
              </th>
              {row.cells.slice(offset).map((cell, index) => (
                <td key={shown[index]} title={cellTitle(cell, shown[index]!)} className="px-1 py-1 text-center">
                  {cell === 'unchecked' ? (
                    <span className="text-fg-faint">?</span>
                  ) : cell ? (
                    <span aria-label="ada" className={row.current ? 'text-accent' : ''}>
                      ●
                    </span>
                  ) : (
                    <span aria-label="tidak ada" className="text-fg-faint">
                      ·
                    </span>
                  )}
                </td>
              ))}
              <td className="whitespace-nowrap px-3 py-1 text-[11px]">
                H{row.days} · {row.path}
                {row.current ? '' : ` · terakhir ${formatDmy(row.lastSeen).slice(0, 5)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollStrip>
  );
}
