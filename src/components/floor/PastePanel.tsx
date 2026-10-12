import { useState } from 'react';

import { Button, Callout } from '@/components/common/ui';
import { writeRosterBatch, type RosterChange } from '@/data/repositories/floors.repo';
import { formatDmy } from '@/domain/dateDmy';
import { newRosterPatient, pasteDiff, updatedReport, type FloorDoc, type PasteDiff, type RosterPatient } from '@/domain/floorList/floor';
import { splitChat } from '@/domain/floorList/chat';
import { onFloorNumber, readReports, type FloorPatient } from '@/domain/floorList/report';
import { chatFromZip } from '@/lib/unzip';

interface Reading {
  diff: PasteDiff;
  otherFloor: FloorPatient[];
  messages: number;
}

const where = (p: FloorPatient): string => `${p.room}${p.bed ? `/${p.bed}` : ''}`;
const when = (p: FloorPatient): string => (p.sentAt ? `${formatDmy(p.sentAt.slice(0, 10))} ${p.sentAt.slice(11, 16)}` : '');

/**
 * Tempel (12.12): paste WhatsApp messages (or open an "Export chat"
 * .zip/.txt) and review what changes BEFORE anything is saved:
 *
 * - new patients — ticked to add (untick to leave out);
 * - newer SOAPs of patients on the floor — applied; a changed room/bed is
 *   asked (ticked);
 * - SOAPs of patients who already left (Pulang/Pindah) — NOT re-added unless
 *   ticked.
 *
 * Nobody is ever removed by a paste. The raw paste is never stored.
 */
export function PastePanel({ floor, roster, myName }: { floor: FloorDoc; roster: readonly RosterPatient[]; myName: string }): JSX.Element {
  const [text, setText] = useState('');
  const [reading, setReading] = useState<Reading | null>(null);
  const [skipFresh, setSkipFresh] = useState<Set<string>>(new Set());
  const [skipMove, setSkipMove] = useState<Set<string>>(new Set());
  const [readmit, setReadmit] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const floorNumber = /\d+/.exec(floor.ward)?.[0] ?? '';

  const read = (raw: string): void => {
    setError('');
    setSaved('');
    setSkipFresh(new Set());
    setSkipMove(new Set());
    setReadmit(new Set());
    const messages = splitChat(raw).map((m) => (m.sender === 'You' ? { ...m, sender: myName } : m));
    const all = messages.flatMap(readReports);
    // Another floor (moved out, CVCU) or no floor yet (IGD) is shown, not filed.
    const reports = all.filter((p) => onFloorNumber(p, floorNumber));
    const otherFloor = all.filter((p) => !reports.includes(p));
    setReading({ diff: pasteDiff(roster, reports), otherFloor, messages: messages.length });
  };

  const openFile = async (file: File): Promise<void> => {
    try {
      const raw = /\.zip$/i.test(file.name) ? await chatFromZip(await file.arrayBuffer()) : await file.text();
      setText(raw.length > 200_000 ? '' : raw);
      read(raw);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'File tidak bisa dibaca.');
    }
  };

  const toggle = (set: Set<string>, key: string, apply: (next: Set<string>) => void): void => {
    const next = new Set(set);
    if (!next.delete(key)) next.add(key);
    apply(next);
  };

  const save = async (): Promise<void> => {
    if (!reading) return;
    setSaving(true);
    setError('');
    const at = new Date().toISOString();
    const log = (what: string) => ({ at, by: myName, what });
    try {
      const fresh = reading.diff.fresh.filter((p) => !skipFresh.has(p.key));
      const moved = new Set(reading.diff.moved.map((m) => m.before.key));
      const back = reading.diff.readmit.filter((r) => readmit.has(r.before.key));
      const changes: RosterChange[] = [
        ...fresh.map((report): RosterChange => ({ kind: 'add', patient: newRosterPatient(report, at, myName) })),
        ...reading.diff.updated.map(({ before, report }): RosterChange => {
          const acceptMove = moved.has(before.key) && !skipMove.has(before.key);
          // Not a confirmed move: the stored room/bed stays (it may have been set by hand).
          return {
            kind: 'report',
            key: before.key,
            report: updatedReport(before.report, report, acceptMove),
            log: acceptMove ? log(`Pindah kamar ${where(before.report)} → ${where(report)}`) : undefined,
          };
        }),
        ...back.flatMap(({ before, report }): RosterChange[] => [
          { kind: 'report', key: before.key, report },
          { kind: 'fields', key: before.key, fields: { status: 'dirawat', leftAt: '', pindahKe: '' }, log: log('Masuk lagi (dari Tempel)') },
        ]),
      ];
      // Cleared first: the cache shows the result at once, the server confirms after.
      setReading(null);
      setText('');
      await writeRosterBatch(floor.id, changes);
      setSaved(`${fresh.length} pasien baru, ${reading.diff.updated.length} SOAP diperbarui${back.length ? `, ${back.length} masuk lagi` : ''}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const d = reading?.diff;
  const nothing = d ? d.fresh.length + d.updated.length + d.readmit.length === 0 : true;

  return (
    <div className="space-y-3">
      <p className="text-xs text-fg-muted">
        Tempel pesan SOAP dari grup WhatsApp (boleh banyak sekaligus), <strong>list pasien yang dikirim rekan</strong>, atau
        buka file <strong>Export chat</strong> (.zip atau .txt). SOAP selalu didahulukan; dari list hanya diagnosis,
        terapi dan plan. Perubahan ditampilkan dulu sebelum disimpan. <strong>Tidak ada pasien yang dikeluarkan</strong> oleh
        tempel — pulang/pindah hanya lewat tab List.
      </p>
      <textarea
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setReading(null);
        }}
        rows={8}
        placeholder="Tempel pesan WhatsApp di sini…"
        aria-label="Pesan WhatsApp"
        className="w-full rounded-xl border border-border bg-surface p-3 font-mono text-xs"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => read(text)} disabled={!text.trim()}>
          Baca
        </Button>
        <label className="inline-flex min-h-tap cursor-pointer items-center rounded-lg border border-border px-3 text-sm font-medium">
          Buka file export…
          <input
            type="file"
            accept=".zip,.txt,.md,text/plain,application/zip"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void openFile(file);
              event.target.value = '';
            }}
          />
        </label>
      </div>

      {error ? (
        <Callout tone="warn" title="Belum bisa">
          {error}
        </Callout>
      ) : null}
      {saved ? <Callout title="Tersimpan">{saved}</Callout> : null}

      {d ? (
        <div className="space-y-3 rounded-xl border border-border bg-surface p-3 text-xs">
          <p>
            {reading!.messages} pesan · {d.fresh.length} baru · {d.updated.length} diperbarui · {d.readmit.length} sudah keluar ·{' '}
            {d.unchanged} tidak berubah
          </p>

          {d.fresh.length > 0 ? (
            <fieldset className="space-y-1">
              <legend className="font-semibold">Pasien baru — centang untuk masuk list</legend>
              {d.fresh.map((p) => (
                <label key={p.key} className="flex min-h-9 items-center gap-2">
                  <input type="checkbox" checked={!skipFresh.has(p.key)} onChange={() => toggle(skipFresh, p.key, setSkipFresh)} />
                  <span>
                    {where(p)} {p.name} <span className="text-fg-faint">· {when(p)}{p.fromList ? ' · dari list' : ''}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}

          {d.moved.length > 0 ? (
            <fieldset className="space-y-1">
              <legend className="font-semibold">Kamar/bed berubah — centang untuk ikut pindah</legend>
              {d.moved.map(({ before, report }) => (
                <label key={before.key} className="flex min-h-9 items-center gap-2">
                  <input type="checkbox" checked={!skipMove.has(before.key)} onChange={() => toggle(skipMove, before.key, setSkipMove)} />
                  <span>
                    {report.name}: {where(before.report)} → <strong>{where(report)}</strong>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}

          {d.updated.length > 0 ? (
            <p className="text-fg-muted">
              SOAP diperbarui: {d.updated.map(({ report }) => `${where(report)} ${report.name}`).join(' · ')}
            </p>
          ) : null}

          {d.readmit.length > 0 ? (
            <fieldset className="space-y-1">
              <legend className="font-semibold">Sudah keluar tapi ada SOAP baru — centang bila masuk lagi</legend>
              {d.readmit.map(({ before, report }) => (
                <label key={before.key} className="flex min-h-9 items-center gap-2">
                  <input type="checkbox" checked={readmit.has(before.key)} onChange={() => toggle(readmit, before.key, setReadmit)} />
                  <span>
                    {where(report)} {report.name} — {before.status === 'pindah' ? `pindah ke ${before.pindahKe}` : 'pulang'}{' '}
                    <span className="text-fg-faint">· SOAP {when(report)}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}

          {reading!.otherFloor.length > 0 ? (
            <p className="text-fg-muted">
              Lantai lain / IGD, tidak dimasukkan: {reading!.otherFloor.map((p) => `${p.name} (${p.floor ? `Lt ${p.floor}` : 'tanpa lantai'})`).join(', ')}
            </p>
          ) : null}

          <Button variant="primary" onClick={() => void save()} disabled={saving || nothing}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
