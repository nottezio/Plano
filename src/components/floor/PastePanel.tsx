import { useState } from 'react';

import { Button, Callout } from '@/components/common/ui';
import { writeReports } from '@/data/repositories/floors.repo';
import { formatDmy } from '@/domain/dateDmy';
import { pastePlan, type FloorDay, type FloorDoc } from '@/domain/floorList/floor';
import { splitChat } from '@/domain/floorList/chat';
import { readReport, type FloorPatient } from '@/domain/floorList/report';
import { chatFromZip } from '@/lib/unzip';

interface Reading {
  reports: FloorPatient[];
  otherFloor: FloorPatient[];
  messages: number;
  plan: ReturnType<typeof pastePlan>;
}

/**
 * Tempel (12.8): paste WhatsApp messages, or open an "Export chat" .zip/.txt,
 * read the reports, show what will change, then file them. Nothing is saved
 * before "Simpan"; the raw paste is never stored, only the reports read out.
 */
export function PastePanel({
  floor,
  days,
  date,
  myName,
}: {
  floor: FloorDoc;
  days: readonly FloorDay[];
  date: string;
  myName: string;
}): JSX.Element {
  const [text, setText] = useState('');
  const [reading, setReading] = useState<Reading | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const floorNumber = /\d+/.exec(floor.ward)?.[0] ?? '';

  const read = (raw: string): void => {
    setError('');
    setSaved('');
    const messages = splitChat(raw).map((m) => (m.sender === 'You' ? { ...m, sender: myName } : m));
    const all = messages.map(readReport).filter((p): p is FloorPatient => p !== null);
    // A report from another floor (moved out, CVCU) is shown, not filed.
    const reports = all.filter((p) => !floorNumber || !p.floor || p.floor === floorNumber);
    const otherFloor = all.filter((p) => !reports.includes(p));
    setReading({ reports, otherFloor, messages: messages.length, plan: pastePlan(days, reports, date) });
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

  const save = async (): Promise<void> => {
    if (!reading) return;
    setSaving(true);
    setError('');
    try {
      for (const [day, list] of reading.plan.byDate) await writeReports(floor.id, day, list);
      setSaved(`${reading.plan.added} pasien baru, ${reading.plan.updated} diperbarui.`);
      setReading(null);
      setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-fg-muted">
        Tempel pesan SOAP dari grup WhatsApp (boleh banyak sekaligus), atau buka file <strong>Export chat</strong> (.zip
        atau .txt). Laporan terbaru tiap pasien yang dipakai.
      </p>
      <textarea
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setReading(null);
        }}
        rows={10}
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

      {reading ? (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-3 text-xs">
          <p>
            <strong>{reading.messages}</strong> pesan · <strong>{reading.reports.length}</strong> laporan pasien terbaca ·{' '}
            <strong>{reading.plan.added}</strong> baru · <strong>{reading.plan.updated}</strong> diperbarui ·{' '}
            {reading.plan.unchanged} sudah ada
          </p>
          {[...reading.plan.byDate].map(([day, list]) => (
            <p key={day} className="text-fg-muted">
              {formatDmy(day)}: {list.map((p) => `${p.room}${p.bed ? `/${p.bed}` : ''} ${p.name}`).join(' · ')}
            </p>
          ))}
          {reading.reports.some((p) => !p.body) ? (
            <p className="text-fg-muted">
              Tanpa Diagnosis/Terapi (dicek):{' '}
              {reading.reports.filter((p) => !p.body).map((p) => p.name).join(', ')}
            </p>
          ) : null}
          {reading.otherFloor.length > 0 ? (
            <p className="text-fg-muted">
              Lantai lain, tidak dimasukkan: {reading.otherFloor.map((p) => `${p.name} (Lt ${p.floor})`).join(', ')}
            </p>
          ) : null}
          <Button onClick={() => void save()} disabled={saving || reading.plan.byDate.size === 0}>
            {saving ? 'Menyimpan…' : 'Simpan ke list'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
