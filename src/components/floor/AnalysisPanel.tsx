import { useMemo, useState, type ReactNode } from 'react';

import { Button, Callout, INPUT } from '@/components/common/ui';
import { SectionLabel } from '@/components/common/PageFrame';
import { BarRows, ChartCard, Columns, LegendKey, TrendLine } from './AnalysisCharts';
import { writeAnalysisTitles } from '@/data/repositories/floors.repo';
import { copyText } from '@/lib/clipboard';
import { formatDmy } from '@/domain/dateDmy';
import { dayName } from '@/domain/mr/morningReport';
import {
  daySummary,
  daySummaryText,
  dpjpLoad,
  MOVE_LABEL,
  movesByDay,
  movements,
  readSectionTitles,
  SECTION_TITLE,
  SECTION_TITLE_MAX,
  sectionTitle,
  stayBuckets,
  tileTitle,
  weekCounts,
  type MoveKind,
  type SectionKey,
  type SectionTitles,
} from '@/domain/floorList/analysis';
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

/** A section's name while renaming: saved when the field is left; blank goes back to the default. */
function TitleField({ id, value, fallback, onCommit }: { id: string; value: string; fallback: string; onCommit: (text: string) => void }): JSX.Element {
  return (
    <input
      key={value}
      aria-label={`Nama bagian ${fallback}`}
      defaultValue={value}
      placeholder={fallback}
      maxLength={SECTION_TITLE_MAX}
      data-title-field={id}
      onBlur={(e) => onCommit(e.target.value.trim())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      className={`${INPUT} !min-h-8 w-full text-xs font-semibold`}
    />
  );
}

function Tile({ label, value, tone, rename }: { label: string; value: number; tone?: string; rename?: ReactNode }): JSX.Element {
  return (
    <div className="min-w-0">
      <p className="text-xl font-semibold leading-tight tabular-nums" style={tone ? { color: tone } : undefined}>
        {value}
      </p>
      {rename ?? <p className="mt-0.5 text-xs leading-snug text-fg-muted">{label}</p>}
    </div>
  );
}

function Block({ title, count, rename, children }: { title: string; count: number; rename?: ReactNode; children: ReactNode }): JSX.Element {
  return (
    <section className="rounded-xl border border-border bg-surface p-2 text-xs">
      <h3 className="mb-1 font-semibold">
        {rename ?? title} <span className="font-normal text-fg-muted">({count})</span>
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
  floorId,
  titles,
  canRename,
}: {
  /** The floor's ward name, for the WhatsApp summary's heading. */
  ward: string;
  floorId: string;
  /** The names the editors gave the sections (empty = the defaults). */
  titles: SectionTitles;
  /** The list's editors may rename the sections. */
  canRename: boolean;
  roster: readonly RosterPatient[];
  view: RosterView;
  date: string;
  editions: readonly Edition[];
  onOpen: (patient: FloorPatient) => void;
}): JSX.Element {
  const moves = useMemo(() => movements(roster), [roster]);
  const day = useMemo(() => daySummary(date, roster, view.active, moves), [date, roster, view.active, moves]);
  const week = useMemo(() => weekCounts(date, moves, editions), [date, moves, editions]);
  /** Two weeks for the charts: a trend needs more than seven points to be one. */
  const trend = useMemo(() => weekCounts(date, moves, editions, 14), [date, moves, editions]);
  const load = useMemo(() => dpjpLoad(view.active), [view.active]);
  const stay = useMemo(() => stayBuckets(roster, date), [roster, date]);
  const short = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const flowTotals = {
    masuk: trend.reduce((n, d) => n + d.masuk, 0),
    pulang: trend.reduce((n, d) => n + d.pulang, 0),
    pindah: trend.reduce((n, d) => n + d.pindah, 0),
  };
  const [filter, setFilter] = useState<MoveKind | 'semua'>('semua');
  const [copied, setCopied] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState(false);
  const name = (key: SectionKey): string => sectionTitle(titles, key);
  const tile = (key: SectionKey): string => tileTitle(titles, key);
  const rename = (key: SectionKey, text: string): void => {
    const next = readSectionTitles({ ...titles, [key]: text });
    if (JSON.stringify(next) === JSON.stringify(titles)) return;
    setRenameError(false);
    void writeAnalysisTitles(floorId, next).catch(() => setRenameError(true));
  };
  /** The title field of a section while renaming (editors only), else nothing. */
  const field = (key: SectionKey, shown: string): ReactNode =>
    renaming ? <TitleField id={key} value={titles[key] ?? ''} fallback={shown} onCommit={(text) => rename(key, text)} /> : undefined;
  const copySummary = (): void => {
    void copyText(daySummaryText(day, ward, titles)).then((ok) => {
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
    <div className="space-y-8">
      <section aria-label="Ringkasan hari ini" className="space-y-3">
      <p className="text-xs text-fg-muted">Tanggal {formatDmy(date)} — dibaca dari catatan perubahan tiap pasien di list (siapa, kapan), tanpa input tambahan.</p>

      <div className="grid grid-cols-3 gap-x-4 gap-y-4 rounded-xl border border-border bg-surface p-4 sm:grid-cols-4 lg:grid-cols-7">
        <Tile label={tile('census')} value={view.active.length} rename={field('census', SECTION_TITLE.census)} />
        <Tile label={tile('masuk')} value={day.masuk.length} />
        <Tile label={tile('pulang')} value={day.pulang.length} />
        <Tile label={tile('pindah')} value={day.pindah.length} />
        <Tile label={tile('pulangHariIni')} value={day.pulangHariIni.length} tone="var(--note-green)" />
        <Tile label={tile('rencanaH1')} value={day.rencanaH1.length} tone="var(--note-red)" />
        <Tile label={tile('usulH1')} value={day.usulH1.length} tone="var(--warn-strong)" />
      </div>

      {renameError ? (
        <Callout tone="warn" title="Nama belum tersimpan">
          Perubahan nama ditolak (mungkin Anda hanya boleh melihat list ini). Coba lagi.
        </Callout>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {canRename ? (
          <Button size="sm" variant={renaming ? 'primary' : 'secondary'} aria-pressed={renaming} onClick={() => setRenaming((on) => !on)}>
            {renaming ? 'Selesai ubah nama' : 'Ubah nama bagian'}
          </Button>
        ) : null}
        <Button size="sm" onClick={copySummary}>
          {copied ? 'Tersalin ✓' : 'Salin ringkasan untuk WhatsApp'}
        </Button>
      </div>
      </section>

      <section aria-label="Tren dua minggu" className="space-y-3">
        <SectionLabel title="Dua minggu terakhir" />
        <div className="grid gap-3 md:grid-cols-2">
          <ChartCard title="Pasien di lantai" note="jumlah pada list terakhir tiap hari">
            <TrendLine
              name="Pasien"
              points={trend.map((d) => ({ label: short(d.date), value: d.census }))}
              ariaLabel={`Jumlah pasien di lantai per hari: ${trend.filter((d) => d.census !== null).map((d) => `${short(d.date)} ${d.census}`).join(', ') || 'belum ada data'}`}
            />
          </ChartCard>
          <ChartCard
            title="Masuk, pulang, pindah"
            note="per hari"
            legend={
              <>
                <LegendKey color="var(--chart-1)" name={tile('masuk')} total={flowTotals.masuk} />
                <LegendKey color="var(--chart-2)" name={tile('pulang')} total={flowTotals.pulang} />
                <LegendKey color="var(--chart-3)" name={tile('pindah')} total={flowTotals.pindah} />
              </>
            }
          >
            <Columns
              groups={trend.map((d) => ({ label: short(d.date), values: [d.masuk, d.pulang, d.pindah] }))}
              series={[
                { name: tile('masuk'), color: 'var(--chart-1)' },
                { name: tile('pulang'), color: 'var(--chart-2)' },
                { name: tile('pindah'), color: 'var(--chart-3)' },
              ]}
              ariaLabel="Pasien masuk, pulang, dan pindah per hari dalam dua minggu terakhir; angka tujuh hari ada di tabel di bawah"
            />
          </ChartCard>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <ChartCard title="Pasien per DPJP" note={`${view.active.length} di lantai`}>
            <BarRows rows={load.map((row) => ({ label: row.code, value: row.count }))} empty="Belum ada pasien di lantai." />
          </ChartCard>
          <ChartCard title="Sudah berapa hari di list" note="pasien yang masih di lantai">
            <Columns
              groups={stay.map((b) => ({ label: b.label, values: [b.count] }))}
              series={[{ name: 'Pasien', color: 'var(--accent)' }]}
              ariaLabel={`Lama di list: ${stay.map((b) => `${b.label} hari ${b.count} pasien`).join(', ')}`}
              showValues
              height={140}
            />
          </ChartCard>
        </div>
      </section>

      <section aria-label="Rincian hari ini" className="space-y-3">
      <SectionLabel title="Hari ini, per pasien" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Block title={name('pulangHariIni')} count={day.pulangHariIni.length} rename={field('pulangHariIni', SECTION_TITLE.pulangHariIni)}>
          {day.pulangHariIni.map((p) => (
            <Row key={p.key} patient={p} onOpen={onOpen} />
          ))}
        </Block>
        <Block title={name('rencanaH1')} count={day.rencanaH1.length} rename={field('rencanaH1', SECTION_TITLE.rencanaH1)}>
          {day.rencanaH1.map((p) => (
            <Row key={p.key} patient={p} onOpen={onOpen} />
          ))}
        </Block>
        <Block title={name('usulH1')} count={day.usulH1.length} rename={field('usulH1', SECTION_TITLE.usulH1)}>
          {day.usulH1.map(({ patient, days }) => (
            <Row key={patient.key} patient={patient} note={days === 0 ? 'usul hari ini' : `usul sejak ${days} hari`} onOpen={onOpen} />
          ))}
        </Block>
        <Block title={name('pulang')} count={day.pulang.length} rename={field('pulang', SECTION_TITLE.pulang)}>
          {day.pulang.map((p) => (
            <Row key={p.key} patient={p.report} note={hm(localOf(p.leftAt))} onOpen={onOpen} />
          ))}
        </Block>
        <Block title={name('pindah')} count={day.pindah.length} rename={field('pindah', SECTION_TITLE.pindah)}>
          {day.pindah.map((p) => (
            <Row key={p.key} patient={p.report} note={`ke ${p.pindahKe || '…'} · ${hm(localOf(p.leftAt))}`} onOpen={onOpen} />
          ))}
        </Block>
        <Block title={name('kamar')} count={day.kamar.length} rename={field('kamar', SECTION_TITLE.kamar)}>
          {day.kamar.map((m) => (
            <Row key={`${m.key}-${m.at}`} patient={m.patient} note={`${m.what.replace(/^Pindah kamar\s*/i, '')} · ${hm(m.at)}`} onOpen={onOpen} />
          ))}
        </Block>
        <Block title={name('masuk')} count={day.masuk.length} rename={field('masuk', SECTION_TITLE.masuk)}>
          {day.masuk.map((m) => (
            <Row key={`${m.key}-${m.at}`} patient={m.patient} note={`${m.what === 'Masuk list' ? 'baru' : m.what.toLowerCase()} · ${hm(m.at)}`} onOpen={onOpen} />
          ))}
        </Block>
      </div>
      </section>

      <details className="group rounded-xl border border-border bg-surface">
        <summary className="flex min-h-tap cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold">
          <span className="flex-1">Angka per hari (7 hari)</span>
          <span aria-hidden="true" className="text-fg-muted transition-transform group-open:rotate-90">›</span>
        </summary>
        <div className="space-y-1 px-4 pb-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-xs">
            <thead>
              <tr className="text-left text-fg-muted">
                <th className="py-1 pr-2 font-medium">Tanggal</th>
                <th className="px-2 font-medium">List</th>
                <th className="px-2 font-medium">{tile('masuk')}</th>
                <th className="px-2 font-medium">{tile('pulang')}</th>
                <th className="px-2 font-medium">{tile('pindah')}</th>
                <th className="px-2 font-medium">{tile('kamar')}</th>
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
        </div>
      </details>

      <section className="space-y-3">
        <SectionLabel title="Riwayat perubahan · 7 hari" />
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
