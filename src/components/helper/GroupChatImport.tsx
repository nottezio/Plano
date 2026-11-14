import { useId, useMemo, useRef, useState, type ReactNode } from 'react';

import { IconCheck, IconChevronRight, IconRefresh, IconTrash, IconUpload } from '@/components/common/Icons';
import { Button, Callout, ChoiceChip, ChipRow } from '@/components/common/ui';
import { formatDmy } from '@/domain/dateDmy';
import { DPJPS } from '@/domain/dpjp';
import { digestChat, type ChatDigest, type ChatPatient, type ReportKind } from '@/domain/census/groupChat';
import { PLACE_LABEL, PLACE_ORDER } from '@/domain/census/maker';
import type { ClinicalDate } from '@/domain/types';
import { chatFromZip } from '@/lib/unzip';

/**
 * "Grup WhatsApp DPJP" in Buat Sensus (2026-11-14): import the DPJP's group
 * export, then check the patients it found before the census goes out.
 *
 * The rows are the check, not a preview: each says where the patient is now,
 * what the newest report was and when, and why it may need a look (moved,
 * maybe going home, diagnoses changed, none found). A row can be left out of
 * the census with one tap; nothing is left out by itself. Tap a row for its
 * timeline: every report in the window, oldest first.
 */

const KIND_LABEL: Record<ReportKind, string> = {
  baru: 'Pasien baru',
  konsul: 'Konsul',
  'follow up': 'Follow up',
  pindah: 'Pindah',
  laporan: 'Laporan',
};

type Filter = 'semua' | 'cek' | 'keluar';

function nameOf(patient: ChatPatient): string {
  return patient.identity.split('/')[0]?.trim() || patient.identity;
}

/** "Hari ini 06.19" / "Kemarin 07.33", against the day the chat was read for. */
function when(at: string, today: string): string {
  const [date = '', time = ''] = at.split(' ');
  const clock = time.replace(':', '.');
  if (date === today) return `Hari ini ${clock}`;
  return `${date < today ? 'Kemarin' : formatDmy(date)} ${clock}`;
}

interface Flags {
  moved: { from: string; to: string } | null;
  home: string | null;
  dxChanged: boolean;
  noDx: boolean;
}

function flagsOf(patient: ChatPatient): Flags {
  const move = [...patient.reports].reverse().find((r) => r.kind === 'pindah' && r.from);
  return {
    moved: move ? { from: move.from!, to: move.location } : null,
    home: patient.homeHint,
    dxChanged: patient.dxChanged,
    noDx: patient.diagnoses.length === 0,
  };
}

const needsLook = (flags: Flags): boolean => !!flags.home || flags.noDx || flags.dxChanged || !!flags.moved;

function Tag({ tone = 'plain', children }: { tone?: 'plain' | 'warn'; children: ReactNode }): JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ${
        tone === 'warn' ? 'bg-[var(--warn-soft)] text-fg' : 'bg-bg-subtle text-fg-muted'
      }`}
    >
      {children}
    </span>
  );
}

export function GroupChatImport({
  digest,
  censusDate,
  onChange,
  onRemove,
}: {
  digest: ChatDigest | null;
  censusDate: ClinicalDate;
  onChange: (next: ChatDigest) => void;
  onRemove: () => void;
}): JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('semua');
  const [open, setOpen] = useState<string | null>(null);
  const dpjpSelect = useId();

  const pick = (): void => input.current?.click();

  const read = async (file: File): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      // The List Maker's reader: iOS `_chat.txt`, Android `WhatsApp Chat with …txt`.
      const text = /\.zip$/i.test(file.name) ? await chatFromZip(await file.arrayBuffer()) : await file.text();
      const next = digestChat({ text, file: file.name, censusDate });
      if (next.patients.length === 0) {
        setError(
          next.messages === 0
            ? `Tidak ada pesan pada ${formatDmy(next.from)} atau ${formatDmy(next.to)}. Ekspor chat terbaru, atau ubah tanggal sensus.`
            : `${next.messages} pesan terbaca, tetapi tidak ada laporan pasien (baris dengan RM).`,
        );
        return;
      }
      // A new export of the same chat keeps what was left out by hand.
      const kept = (digest?.skipped ?? []).filter((key) => next.patients.some((p) => p.key === key));
      onChange({ ...next, skipped: kept, code: next.code || digest?.code || '' });
      setOpen(null);
    } catch (caught) {
      setError(
        caught instanceof Error && /zip|teks/i.test(caught.message)
          ? caught.message
          : 'File ini tidak bisa dibaca sebagai ekspor chat WhatsApp. Coba ekspor ulang, atau buka di Chrome terbaru.',
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept=".zip,.txt,application/zip,text/plain"
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void read(file);
      }}
    />
  );

  const rows = useMemo(
    () => (digest ? digest.patients.map((patient) => ({ patient, flags: flagsOf(patient) })) : []),
    [digest],
  );

  if (!digest) {
    return (
      <div className="rounded-xl border border-border bg-surface p-3">
        {fileInput}
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Grup WhatsApp DPJP</p>
            <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">
              Untuk sensus pagi sebelum list ruangan datang: ekspor chat grup DPJP, lalu impor file .zip-nya. Laporan
              kemarin dan hari ini dibaca, satu baris per pasien.
            </p>
          </div>
          <Button variant="primary" size="sm" icon={<IconUpload className="h-4 w-4" />} disabled={busy} onClick={pick}>
            {busy ? 'Membaca…' : 'Impor .zip'}
          </Button>
        </div>
        <details className="group mt-2 text-xs text-fg-muted">
          <summary className="inline-flex min-h-tap cursor-pointer select-none items-center gap-1 rounded-lg font-medium text-accent [@media(pointer:fine)]:min-h-8">
            <IconChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
            Cara ekspor chat
          </summary>
          <dl className="mt-1 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-fg">iPhone</dt>
              <dd>Buka grup → ketuk nama grup → Ekspor Chat → Tanpa Media → Simpan ke File.</dd>
            </div>
            <div>
              <dt className="font-semibold text-fg">Android</dt>
              <dd>Buka grup → ⋮ → Lainnya → Ekspor chat → Tanpa media → simpan ke perangkat.</dd>
            </div>
          </dl>
        </details>
        {error ? (
          <div className="mt-2">
            <Callout tone="danger" role="alert" title="Chat belum terbaca">
              {error}
            </Callout>
          </div>
        ) : null}
      </div>
    );
  }

  const skipped = new Set(digest.skipped);
  const toCheck = rows.filter((row) => needsLook(row.flags) && !skipped.has(row.patient.key)).length;
  const included = rows.length - skipped.size;
  const shown = rows.filter(({ patient, flags }) =>
    filter === 'keluar' ? skipped.has(patient.key) : filter === 'cek' ? needsLook(flags) && !skipped.has(patient.key) : true,
  );
  const groups = PLACE_ORDER.map((place) => ({ place, rows: shown.filter((row) => row.patient.place === place) })).filter(
    (group) => group.rows.length > 0,
  );
  const toggle = (key: string): void =>
    onChange({ ...digest, skipped: skipped.has(key) ? digest.skipped.filter((k) => k !== key) : [...digest.skipped, key] });
  const stale = digest.to !== censusDate;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {fileInput}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-3 py-1.5">
        <div className="min-w-0 flex-1 py-1 text-xs">
          <p className="font-semibold">Grup WhatsApp</p>
          <p className="tabular-nums text-fg-muted">
            {formatDmy(digest.from).slice(0, 5)}–{formatDmy(digest.to).slice(0, 5)} · {digest.reports} laporan ·{' '}
            {included} pasien
          </p>
        </div>
        <label htmlFor={dpjpSelect} className="sr-only">
          DPJP grup ini
        </label>
        <select
          id={dpjpSelect}
          value={digest.code}
          onChange={(event) => onChange({ ...digest, code: event.target.value })}
          className="min-h-tap shrink-0 rounded-lg border border-border bg-surface px-2 text-xs [@media(pointer:fine)]:min-h-8"
        >
          {digest.code ? null : <option value="">Pilih DPJP…</option>}
          {DPJPS.map((dpjp) => (
            <option key={dpjp.id} value={dpjp.initials}>
              DPJP {dpjp.initials}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label="Impor ulang chat grup"
          title="Impor ulang"
          disabled={busy}
          onClick={pick}
          className="flex min-h-tap min-w-tap items-center justify-center rounded-lg text-fg-faint hover:bg-bg-subtle hover:text-fg disabled:opacity-40 [@media(pointer:fine)]:min-h-8"
        >
          <IconRefresh className={`h-4 w-4 ${busy ? 'animate-spin motion-reduce:animate-none' : ''}`} />
        </button>
        <button
          type="button"
          aria-label="Hapus chat grup dari sensus"
          title="Hapus"
          onClick={onRemove}
          className="flex min-h-tap min-w-tap items-center justify-center rounded-lg text-fg-faint hover:bg-[var(--danger-soft)] hover:text-danger [@media(pointer:fine)]:min-h-8"
        >
          <IconTrash className="h-4 w-4" />
        </button>
      </div>

      {stale || error || !digest.code ? (
        <div className="space-y-2 border-b border-border px-3 py-2">
          {error ? (
            <Callout tone="danger" role="alert" title="Chat belum terbaca">
              {error}
            </Callout>
          ) : null}
          {stale ? (
            <Callout tone="warn" title={`Dibaca untuk sensus ${formatDmy(digest.to)}`}>
              Tanggal sensus sekarang {formatDmy(censusDate)}. Impor ulang ekspor terbaru agar laporan kemarin dan hari ini
              yang terbaca.
            </Callout>
          ) : null}
          {!digest.code ? (
            <Callout tone="warn" title="DPJP grup tidak terbaca">
              Pilih DPJP di atas; tanpa itu pasien grup tidak masuk sensus siapa pun.
            </Callout>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
        <ChipRow>
          <ChoiceChip active={filter === 'semua'} onClick={() => setFilter('semua')}>
            Semua · {rows.length}
          </ChoiceChip>
          <ChoiceChip active={filter === 'cek'} onClick={() => setFilter('cek')}>
            Perlu dicek · {toCheck}
          </ChoiceChip>
          {skipped.size > 0 ? (
            <ChoiceChip active={filter === 'keluar'} onClick={() => setFilter('keluar')}>
              Tidak masuk · {skipped.size}
            </ChoiceChip>
          ) : null}
        </ChipRow>
        {digest.older > 0 ? <p className="text-xs text-fg-faint">{digest.older} pesan lebih lama tidak dibaca.</p> : null}
      </div>

      {groups.length === 0 ? (
        <p className="border-t border-border px-3 py-4 text-center text-xs text-fg-muted">
          {filter === 'cek' ? 'Tidak ada yang perlu dicek. Semua baris lengkap.' : 'Tidak ada pasien di sini.'}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.place} aria-label={PLACE_LABEL[group.place]} className="border-t border-border">
            <h4 className="bg-bg-subtle px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
              {PLACE_LABEL[group.place]} · {group.rows.length}
            </h4>
            <ul className="divide-y divide-border">
              {group.rows.map(({ patient, flags }) => {
                const out = skipped.has(patient.key);
                const last = patient.reports.at(-1)!;
                const expanded = open === patient.key;
                const detailId = `chat-${patient.key}`;
                return (
                  <li key={patient.key} className={out ? 'bg-bg-subtle' : ''}>
                    <div className="flex items-stretch">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={detailId}
                        onClick={() => setOpen(expanded ? null : patient.key)}
                        className="flex min-h-tap min-w-0 flex-1 items-start gap-2 px-3 py-2 text-left hover:bg-bg-subtle focus-visible:bg-bg-subtle focus-visible:outline-none"
                      >
                        <IconChevronRight
                          className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-faint transition-transform motion-reduce:transition-none ${expanded ? 'rotate-90' : ''}`}
                        />
                        <span className={`min-w-0 flex-1 ${out ? 'opacity-60' : ''}`}>
                          <span className="block truncate text-sm">
                            <span className="font-semibold">{patient.location || 'Tempat tidak tertulis'}</span>
                            <span className="text-fg-muted"> · {nameOf(patient)}</span>
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-fg-muted">
                            <span className="mr-1 tabular-nums">
                              {KIND_LABEL[last.kind]} · {when(last.at, digest.to)}
                            </span>
                            {flags.home ? <Tag tone="warn">Mungkin pulang</Tag> : null}
                            {flags.noDx ? <Tag tone="warn">Tanpa diagnosis</Tag> : null}
                            {flags.moved && last.kind !== 'pindah' ? <Tag>Pindah</Tag> : null}
                            {flags.dxChanged ? <Tag>Dx berubah</Tag> : null}
                            {patient.kjs ? <Tag>{patient.kjs}</Tag> : null}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={!out}
                        aria-label={out ? `Masukkan ${nameOf(patient)} ke sensus` : `Keluarkan ${nameOf(patient)} dari sensus`}
                        onClick={() => toggle(patient.key)}
                        // Included is the normal state, so it stays quiet; a row left out is the one to see.
                        className={`my-1 mr-2 inline-flex min-h-tap shrink-0 items-center gap-1 self-center rounded-lg border px-2.5 text-xs font-medium transition-colors [@media(pointer:fine)]:min-h-8 ${
                          out
                            ? 'border-dashed border-border-strong text-fg-faint hover:text-fg-muted'
                            : 'border-border text-fg-muted hover:border-border-strong hover:text-fg'
                        }`}
                      >
                        {out ? null : <IconCheck width={14} height={14} strokeWidth={2.5} />}
                        {out ? 'Tidak masuk' : 'Masuk'}
                      </button>
                    </div>
                    {expanded ? (
                      <div id={detailId} className="space-y-2 px-3 pb-3 pl-8 text-xs">
                        {flags.home ? (
                          <p className="rounded-lg bg-[var(--warn-soft)] px-2 py-1.5">
                            <span className="font-semibold">Laporan terakhir: </span>“{flags.home}”
                          </p>
                        ) : null}
                        <p className="break-words text-fg-muted">{patient.identity}</p>
                        <ol className="space-y-0.5">
                          {patient.reports.map((report, index) => (
                            <li key={index} className="flex gap-2">
                              <span className="w-24 shrink-0 tabular-nums text-fg-faint">{when(report.at, digest.to)}</span>
                              <span className="min-w-0">
                                <span className="font-medium">{KIND_LABEL[report.kind]}</span>
                                {report.from ? (
                                  <span className="text-fg-muted">
                                    {' '}
                                    · {report.from} → {report.location}
                                  </span>
                                ) : report.location ? (
                                  <span className="text-fg-muted"> · {report.location}</span>
                                ) : null}
                              </span>
                            </li>
                          ))}
                        </ol>
                        <div>
                          <p className="font-semibold">Diagnosis{flags.dxChanged ? ' (laporan terbaru)' : ''}</p>
                          {patient.diagnoses.length > 0 ? (
                            <ul className="mt-0.5 space-y-0.5 text-fg-muted">
                              {patient.diagnoses.map((line, index) => (
                                <li key={index}>{line}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-0.5 text-fg-muted">
                              Tidak ada blok diagnosis di laporannya; sensus menulis “-”. Cek di list ruangan.
                            </p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
