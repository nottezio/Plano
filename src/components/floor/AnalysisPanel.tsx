import { useMemo, useState, type ReactNode } from 'react';

import { Button, Callout } from '@/components/common/ui';
import { copyText } from '@/lib/clipboard';
import { formatDmy } from '@/domain/dateDmy';
import { dayName } from '@/domain/mr/morningReport';
import { daySummary, daySummaryText, MOVE_LABEL, movesByDay, movements, weekCounts, type MoveKind } from '@/domain/floorList/analysis';
import { localStamp, type Edition, type RosterPatient, type RosterView } from '@/domain/floorList/floor';
import type { FloorPatient } from '@/domain/floorList/report';
import { checkSlaber, readSlaber, type Slaber } from '@/domain/floorList/slaber';
import { docxDocumentXml } from '@/lib/unzip';

const hm = (stamp: string): string => stamp.slice(11, 16);
const place = (p: FloorPatient): string => `${p.room}${p.bed ? `/${p.bed}` : ''}`;
const localOf = (iso: string): string => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? '' : localStamp(at);
};

function Tile({ label, value, tone }: { label: string; value: number; tone?: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-surface p-2">
      <p className="text-2xl font-semibold tabular-nums" style={tone ? { color: tone } : undefined}>
        {value}
      </p>
      <p className="text-xs text-fg-muted">{label}</p>
    </div>
  );
}

function Block({ title, count, children }: { title: string; count: number; children: ReactNode }): JSX.Element {
  return (
    <section className="rounded-xl border border-border bg-surface p-2 text-xs">
      <h3 className="mb-1 font-semibold">
        {title} <span className="font-normal text-fg-muted">({count})</span>
      </h3>
      {count === 0 ? <p className="text-fg-faint">—</p> : <ol className="max-h-64 space-y-0.5 overflow-y-auto">{children}</ol>}
    </section>
  );
}

function Row({ patient, note, onOpen }: { patient: FloorPatient; note?: string; onOpen: (p: FloorPatient) => void }): JSX.Element {
  return (
    <li>
      <button type="button" onClick={() => onOpen(patient)} className="text-left hover:underline">
        {place(patient)} {patient.name}
        {note ? <span className="text-fg-muted"> · {note}</span> : null}
      </button>
    </li>
  );
}

const FILTERS: ReadonlyArray<MoveKind | 'semua'> = ['semua', 'masuk', 'pulang', 'pindah', 'kamar', 'rencana', 'lain'];

/**
 * Analisis (13.12): the day's movement (who came in, went home, left, moved
 * room; who is green or red now), a week of counts, the change history, and
 * the check against the nurses' handover sheet.
 */
export function AnalysisPanel({
  roster,
  view,
  date,
  editions,
  onOpen,
  ward,
}: {
  /** The floor's ward name, for the WhatsApp summary's heading. */
  ward: string;
  roster: readonly RosterPatient[];
  view: RosterView;
  date: string;
  editions: readonly Edition[];
  onOpen: (patient: FloorPatient) => void;
}): JSX.Element {
  const moves = useMemo(() => movements(roster), [roster]);
  const day = useMemo(() => daySummary(date, roster, view.active, moves), [date, roster, view.active, moves]);
  const week = useMemo(() => weekCounts(date, moves, editions), [date, moves, editions]);
  const [filter, setFilter] = useState<MoveKind | 'semua'>('semua');
  const [copied, setCopied] = useState(false);
  const copySummary = (): void => {
    void copyText(daySummaryText(day, ward)).then((ok) => {
      setCopied(ok);
      if (ok) window.setTimeout(() => setCopied(false), 2000);
    });
  };
  const from = week[0]?.date ?? date;
  const history = moves.filter((m) => m.at.slice(0, 10) >= from && m.at.slice(0, 10) <= date && (filter === 'semua' || m.kind === filter));

  const [sheet, setSheet] = useState<Slaber | null>(null);
  const [sheetError, setSheetError] = useState('');
  const check = useMemo(() => (sheet ? checkSlaber(sheet, view.active, roster) : null), [sheet, view.active, roster]);
  const openSheet = async (file: File): Promise<void> => {
    setSheetError('');
    try {
      const read = readSlaber(await docxDocumentXml(await file.arrayBuffer()));
      if (read.rows.length === 0) throw new Error('Tabel pasien (kolom BED dan NAMA) tidak ditemukan di file ini.');
      setSheet(read);
    } catch (e) {
      setSheet(null);
      setSheetError(e instanceof Error ? e.message : 'File tidak bisa dibaca.');
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-fg-muted">Tanggal {formatDmy(date)} — dibaca dari catatan perubahan tiap pasien di list (siapa, kapan), tanpa input tambahan.</p>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Tile label="Di lantai" value={view.active.length} />
        <Tile label="Masuk" value={day.masuk.length} />
        <Tile label="Pulang" value={day.pulang.length} />
        <Tile label="Pindah ruangan" value={day.pindah.length} />
        <Tile label="Rencana pulang hari ini" value={day.pulangHariIni.length} tone="var(--note-green)" />
        <Tile label="Rencana H-1" value={day.rencanaH1.length} tone="var(--note-red)" />
        <Tile label="Usul H-1" value={day.usulH1.length} tone="var(--warn-strong)" />
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={copySummary}>
          {copied ? 'Tersalin ✓' : 'Salin ringkasan untuk WhatsApp'}
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Block title="Rencana pulang hari ini (masih di lantai)" count={day.pulangHariIni.length}>
          {day.pulangHariIni.map((p) => (
            <Row key={p.key} patient={p} onOpen={onOpen} />
          ))}
        </Block>
        <Block title="Rencana H-1 (pulang besok)" count={day.rencanaH1.length}>
          {day.rencanaH1.map((p) => (
            <Row key={p.key} patient={p} onOpen={onOpen} />
          ))}
        </Block>
        <Block title="Usul H-1 (menunggu konfirmasi DPJP)" count={day.usulH1.length}>
          {day.usulH1.map(({ patient, days }) => (
            <Row key={patient.key} patient={patient} note={days === 0 ? 'usul hari ini' : `usul sejak ${days} hari`} onOpen={onOpen} />
          ))}
        </Block>
        <Block title="Sudah pulang" count={day.pulang.length}>
          {day.pulang.map((p) => (
            <Row key={p.key} patient={p.report} note={hm(localOf(p.leftAt))} onOpen={onOpen} />
          ))}
        </Block>
        <Block title="Pindah ruangan" count={day.pindah.length}>
          {day.pindah.map((p) => (
            <Row key={p.key} patient={p.report} note={`ke ${p.pindahKe || '…'} · ${hm(localOf(p.leftAt))}`} onOpen={onOpen} />
          ))}
        </Block>
        <Block title="Pindah kamar (di lantai ini)" count={day.kamar.length}>
          {day.kamar.map((m) => (
            <Row key={`${m.key}-${m.at}`} patient={m.patient} note={`${m.what.replace(/^Pindah kamar\s*/i, '')} · ${hm(m.at)}`} onOpen={onOpen} />
          ))}
        </Block>
        <Block title="Masuk list" count={day.masuk.length}>
          {day.masuk.map((m) => (
            <Row key={`${m.key}-${m.at}`} patient={m.patient} note={`${m.what === 'Masuk list' ? 'baru' : m.what.toLowerCase()} · ${hm(m.at)}`} onOpen={onOpen} />
          ))}
        </Block>
      </div>

      <section className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-faint">7 hari terakhir</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-xs">
            <thead>
              <tr className="text-left text-fg-muted">
                <th className="py-1 pr-2 font-medium">Tanggal</th>
                <th className="px-2 font-medium">List</th>
                <th className="px-2 font-medium">Masuk</th>
                <th className="px-2 font-medium">Pulang</th>
                <th className="px-2 font-medium">Pindah ruangan</th>
                <th className="px-2 font-medium">Pindah kamar</th>
              </tr>
            </thead>
            <tbody>
              {week.map((d) => (
                <tr key={d.date} className={`border-t border-border tabular-nums ${d.date === date ? 'font-semibold' : ''}`}>
                  <td className="py-1 pr-2">{formatDmy(d.date)}</td>
                  <td className="px-2">{d.census ?? '—'}</td>
                  <td className="px-2">{d.masuk}</td>
                  <td className="px-2">{d.pulang}</td>
                  <td className="px-2">{d.pindah}</td>
                  <td className="px-2">{d.kamar}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-fg-faint">"List" = jumlah pasien pada list terakhir yang disimpan hari itu.</p>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-faint">Riwayat perubahan (7 hari)</h3>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`min-h-8 rounded-full border px-2.5 text-xs font-semibold ${filter === f ? 'border-accent bg-accent text-on-accent' : 'border-border text-fg-muted'}`}
            >
              {f === 'semua' ? 'Semua' : MOVE_LABEL[f]}
            </button>
          ))}
        </div>
        {history.length === 0 ? <p className="text-xs text-fg-faint">Tidak ada perubahan.</p> : null}
        {/*
          By day (2026-10-16, Avi): a heading per day with its count, the
          newest day open, older days folded; the whole history scrolls
          inside a box of at most 60% of the screen, not the page.
        */}
        <div className="max-h-[60vh] space-y-1 overflow-y-auto overscroll-contain rounded-lg border border-border">
          {movesByDay(history).map((day, i) => (
            <details key={day.date} open={i === 0} className="group">
              <summary className="sticky top-0 z-10 flex min-h-8 cursor-pointer items-center gap-2 border-b border-border bg-bg-subtle px-2 text-xs font-semibold">
                <span>
                  {dayName(day.date)}, {formatDmy(day.date)}
                </span>
                <span className="font-normal text-fg-muted">· {day.moves.length} perubahan</span>
              </summary>
              <ol className="space-y-0.5 px-2 py-1 text-xs">
                {day.moves.map((m) => (
                  <li key={`${m.key}-${m.at}-${m.what}`} className="flex gap-2">
                    <span className="w-10 shrink-0 tabular-nums text-fg-muted">{hm(m.at)}</span>
                    <button type="button" onClick={() => onOpen(m.patient)} className="min-w-0 flex-1 text-left hover:underline">
                      <strong>{m.what}</strong> — {place(m.patient)} {m.patient.name}
                      <span className="text-fg-faint"> · {m.by}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      </section>

      <section className="space-y-2 rounded-xl border border-border p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-faint">Cek dengan slaber perawat</h3>
        <p className="text-xs text-fg-muted">
          Buka file Word laporan dinas / timbang terima perawat. List dibandingkan dengan slaber lewat RM (atau nama): pasien
          kardiologi yang belum ada di list, pasien list yang tidak ada di slaber, dan kamar/bed yang berbeda.
        </p>
        <label className="inline-flex min-h-tap cursor-pointer items-center rounded-lg border border-border px-3 text-sm font-medium">
          Buka slaber (.docx)…
          <input
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void openSheet(file);
              event.target.value = '';
            }}
          />
        </label>
        {sheetError ? (
          <Callout tone="warn" title="Belum bisa">
            {sheetError}
          </Callout>
        ) : null}
        {sheet && check ? (
          <div className="space-y-2 text-xs">
            <p>
              Slaber {sheet.day || '—'}
              {sheet.shift ? ` · dinas ${sheet.shift.toLowerCase()}` : ''} · {sheet.rows.length} pasien di lantai · {check.matched} cocok ·{' '}
              {check.others} bukan pasien kardiologi
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Block title="Di slaber (kardiologi), tidak ada di list" count={check.missing.length}>
                {check.missing.map(({ row, left }) => (
                  <li key={`${row.rm}-${row.name}`}>
                    {row.room}
                    {row.bed ? `/${row.bed}` : ''} {row.name} · RM {row.rm}
                    {left ? (
                      <span className="text-fg-muted"> · di Plano: {left.status === 'pindah' ? `pindah ke ${left.pindahKe}` : 'pulang'}</span>
                    ) : null}
                  </li>
                ))}
              </Block>
              <Block title="Di list, tidak ada di slaber" count={check.notOnSheet.length}>
                {check.notOnSheet.map((p) => (
                  <Row key={p.key} patient={p} note="sudah pulang/pindah?" onOpen={onOpen} />
                ))}
              </Block>
              <Block title="Kamar/bed berbeda" count={check.placeDiffers.length}>
                {check.placeDiffers.map(({ row, patient }) => (
                  <Row key={patient.key} patient={patient} note={`slaber: ${row.room}${row.bed ? `/${row.bed}` : ''}`} onOpen={onOpen} />
                ))}
              </Block>
            </div>
            <details>
              <summary className="cursor-pointer text-fg-muted">Lihat semua baris slaber</summary>
              <ol className="mt-1 space-y-0.5">
                {sheet.rows.map((row) => (
                  <li key={`${row.rm}-${row.name}`} className={row.cardio ? '' : 'text-fg-faint'}>
                    {row.room}
                    {row.bed ? `/${row.bed}` : ''} {row.name} · RM {row.rm}
                    {row.cardio ? ' · kardiologi' : ''}
                  </li>
                ))}
              </ol>
            </details>
          </div>
        ) : null}
      </section>

      <p className="text-xs text-fg-faint">Ketuk nama untuk membuka SOAP.</p>
    </div>
  );
}
