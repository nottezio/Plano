import { useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { fetchEntryBodies } from '@/data/repositories/entries.repo';
import { formatHistory, selectHistory } from '@/domain/format/historySummary';
import { copyText } from '@/lib/clipboard';
import { AiError, askClaude } from '@/lib/ai';

/**
 * "Ringkas perjalanan pasien" — the summary you read out when a consultant
 * asks who this patient is.
 *
 * WHY THIS IS THE ONE PLACE A MODEL EARNS ITS KEEP HERE
 *
 * Every other AI feature in Plano competes with deterministic code that does
 * the job better: the section parser is lossless, the lab parser is exact, the
 * checker compares numbers. This one has no deterministic equivalent, because
 * the task is not transformation — it is deciding which three weeks of daily
 * notes matter and which do not, and saying it in the order a DPJP expects to
 * hear it.
 *
 * It also cannot damage anything. Nothing is written back to the note; the
 * output exists to be read aloud or pasted into a message, and it is wrong in
 * a way the person reading it can see, because they were there.
 *
 * WHAT IT IS NOT FOR
 *
 * Not the record. A summary is a retelling and retellings lose things — which
 * is fine when you are standing next to the patient and terrible when it is
 * filed. There is deliberately no "insert into note".
 */
export function HistorySummarySheet({
  open,
  onOpenChange,
  patientId,
  identity,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  /** Name, age, MRN, bed — from the record, never asked of the model. */
  identity: string;
}): JSX.Element {
  const [state, setState] = useState<'idle' | 'reading' | 'running'>('idle');
  const [summary, setSummary] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const run = async (): Promise<void> => {
    setState('reading');
    setError(null);
    try {
      const entries = await fetchEntryBodies(patientId);
      const selection = selectHistory(
        entries.map((entry) => ({ date: entry.date, body: entry.body ?? '' })),
      );

      if (selection.included.length === 0) {
        setError('Belum ada catatan untuk diringkas.');
        setState('idle');
        return;
      }

      setNote(
        selection.omitted.length > 0
          ? `${selection.included.length} hari dikirim, ${selection.omitted.length} hari di tengah dilewati karena terlalu panjang.`
          : `${selection.included.length} hari dikirim, lengkap.`,
      );

      setState('running');
      const text = await askClaude(formatHistory(selection), {
        system: [
          'Kamu meringkas perjalanan rawat pasien kardiologi untuk DIPRESENTASIKAN',
          'ke DPJP saat visite. Sumbernya catatan harian, urut dari hari pertama.',
          '',
          'URUTAN yang harus diikuti, dengan judul persis seperti ini:',
          'Identitas',
          'DPJP',
          'Diagnosis',
          'Perjalanan singkat',
          'Keluhan sekarang',
          'Terapi saat ini',
          'Plan / KJS',
          '',
          'ISI tiap bagian:',
          '- Identitas: nama, umur, RM, ruang/bed. Salin apa adanya.',
          '- DPJP: semua DPJP yang tercatat, termasuk TS lain dan perannya.',
          '- Diagnosis: daftar diagnosis terakhir, bukan gabungan semua hari.',
          '- Perjalanan singkat: 3-6 poin. Kejadian yang mengubah tatalaksana saja',
          '  — masuk, tindakan, perburukan, perbaikan. Bukan ringkasan tiap hari.',
          '- Keluhan sekarang: dari catatan HARI TERAKHIR saja.',
          '- Terapi saat ini: obat aktif hari terakhir. Yang sudah selesai jangan',
          '  dimasukkan.',
          '- Plan / KJS: rencana yang masih berjalan, dan apa yang ditunggu dari',
          '  TS lain.',
          '',
          'ATURAN KERAS:',
          // The failure mode of a summary is not a wrong word, it is a
          // confident number that was never measured. Everything here is a
          // quotation, not a calculation.
          '- JANGAN mengubah angka, dosis, satuan, atau tanggal. Salin persis.',
          '- JANGAN menyimpulkan hal yang tidak tertulis. Tidak ada di catatan',
          '  berarti tidak disebut.',
          '- JANGAN memberi saran klinis atau diagnosis baru.',
          '- Kalau ada bagian "CATATAN YANG TIDAK DISERTAKAN", sebutkan di akhir',
          '  bahwa tanggal itu tidak dibaca.',
          '- Bahasa Indonesia, ringkas, poin-poin. Tanpa markdown (#, **).',
        ].join('\n'),
        maxTokens: 2000,
      });
      setSummary(text);
    } catch (cause) {
      setError(cause instanceof AiError ? cause.message : 'Gagal memanggil AI.');
    } finally {
      setState('idle');
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Ringkas perjalanan pasien (AI)"
      description="Untuk dibacakan ke DPJP. Tidak masuk ke catatan."
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void run()}
          disabled={state !== 'idle'}
          className="min-h-tap rounded-lg border border-border px-3 text-xs font-medium disabled:opacity-50"
        >
          {state === 'reading'
            ? 'Membaca catatan…'
            : state === 'running'
              ? 'Meringkas…'
              : summary
                ? 'Ringkas ulang'
                : 'Buat ringkasan'}
        </button>
        {summary ? (
          <button
            type="button"
            onClick={() => {
              void copyText(summary);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
            className="min-h-tap rounded-lg border border-border px-3 text-xs font-medium"
          >
            {copied ? 'Tersalin' : 'Salin'}
          </button>
        ) : null}
        {/*
          How much was read, said before the summary is trusted. A retelling
          that skipped a week reads exactly like one that did not.
        */}
        {note ? <span className="text-[11px] text-fg-muted">{note}</span> : null}
      </div>

      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}

      <p className="mt-2 text-[11px] text-fg-faint">
        Identitas di bawah diambil dari data pasien, bukan dari AI: {identity}
      </p>

      {summary ? (
        <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-border bg-surface px-3 py-2 text-xs leading-relaxed">
          {summary}
        </pre>
      ) : null}

      <p className="mt-3 text-[11px] text-fg-faint">
        Periksa angka dan tanggalnya sebelum dibacakan. Ringkasan adalah penceritaan ulang,
        dan penceritaan ulang bisa kehilangan hal yang penting.
      </p>
    </Sheet>
  );
}
