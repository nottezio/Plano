import { useMemo, useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { cvcuToBangsal } from '@/domain/reformat/cvcuToBangsal';
import { AiError, aiEnabled, askClaude } from '@/lib/ai';
import { diffSegments } from '@/domain/merge/threeWayMerge';

/**
 * Reformat a CVCU note into the bangsal layout.
 *
 * Shown as a draft, applied only when the user presses the button.
 *
 * The transform is now narrow: it removes the organ-system headers and changes
 * nothing else. An earlier version also re-ordered the section — vitals up,
 * investigations down — which is what the bangsal notes look like, and which
 * broke real notes, because re-ordering means deciding what each line is and
 * every wrong decision moves a finding somewhere it does not belong.
 *
 * The applied text lands in the editor, not in the database, so it still passes
 * through the normal autosave and revision trail. If it is wrong, the previous
 * version is one entry back in "Riwayat perubahan".
 */
export function ReformatSheet({
  open,
  onOpenChange,
  body,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  body: string;
  onApply: (next: string) => void;
}): JSX.Element {
  const deterministic = useMemo(() => cvcuToBangsal(body), [body]);

  /**
   * The AI second pass — a FALLBACK, offered only after the real transform ran.
   *
   * `cvcuToBangsal` stays the default and stays first. It moves blocks whole,
   * never looks inside one, and produces the same output every time, which is
   * what makes it safe to apply to a note without reading every line. The
   * model has none of those properties.
   *
   * It earns a place only where the deterministic pass leaves something wrong:
   * a CVCU note with headings it has never seen, or a layout nobody has taught
   * it. Offering it BEFORE that would replace a transform that is right by
   * construction with one that is usually right, which is a bad trade on a
   * medical record.
   *
   * It is given the deterministic result, not the original: fixing what is
   * left is a smaller and more checkable job than redoing the whole
   * conversion.
   */
  const [aiBody, setAiBody] = useState<string | null>(null);
  const [aiState, setAiState] = useState<'idle' | 'running'>('idle');
  const [aiError, setAiError] = useState<string | null>(null);

  const result = aiBody !== null ? { ...deterministic, body: aiBody } : deterministic;

  const runAi = async (): Promise<void> => {
    setAiState('running');
    setAiError(null);
    try {
      const text = await askClaude(deterministic.body, {
        system: [
          'Catatan ini sudah diubah otomatis dari format CVCU ke format bangsal,',
          'tapi mungkin masih ada sisa header CVCU atau blok yang salah tempat.',
          'Perbaiki SUSUNANNYA saja.',
          '',
          'ATURAN KERAS:',
          '- JANGAN mengubah kata, angka, dosis, satuan, atau tanggal apa pun.',
          '- JANGAN menambah atau menghapus isi. Semua temuan harus tetap ada.',
          '- Yang boleh: menghapus sisa header A-H (Airway/Breathing/dst),',
          '  memindahkan blok utuh ke bawah S/O/A/P yang tepat, merapikan baris kosong.',
          '- JANGAN memindahkan baris satu per satu; pindahkan blok beserta judulnya.',
          '- Keluarkan HANYA catatannya, tanpa pengantar.',
        ].join('\n'),
        maxTokens: 3000,
      });
      setAiBody(text);
    } catch (error) {
      setAiError(error instanceof AiError ? error.message : 'Gagal memanggil AI.');
    } finally {
      setAiState('idle');
    }
  };
  /**
   * Two views, the same pair the day comparison offers.
   *
   * A single pane of output tells you what the result says but not what moved,
   * and "what moved" is the only question worth asking of a transform you are
   * about to apply to a clinical note.
   */
  const [view, setView] = useState<'berdampingan' | 'perubahan'>('berdampingan');
  const segments = useMemo(
    () => (view === 'perubahan' ? diffSegments(body, result.body) : null),
    [view, body, result.body],
  );
  const changed = result.body !== body;
  const delta = aiBody !== null ? aiBody.length - deterministic.body.length : 0;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Ubah ke format bangsal"
      description="Menghapus header Airway/Breathing/Circulation dst. Urutan tidak berubah."
      footer={
        <button
          type="button"
          disabled={!changed}
          onClick={() => {
            onApply(result.body);
            onOpenChange(false);
          }}
          className="min-h-tap w-full rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          Terapkan
        </button>
      }
    >
      {/*
        Offered after the transform, not instead of it — and only with a key
        and the switch on.
      */}
      {aiEnabled('soap') && changed ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-border pb-3">
          <span className="text-xs text-fg-muted">Hasilnya masih belum rapi?</span>
          <button
            type="button"
            onClick={() => void runAi()}
            disabled={aiState === 'running'}
            className="min-h-tap rounded-lg border border-border px-3 text-xs font-medium disabled:opacity-50"
          >
            {aiState === 'running' ? 'Memperbaiki…' : 'Perbaiki dengan AI'}
          </button>
          {aiBody !== null ? (
            <>
              <button
                type="button"
                onClick={() => setAiBody(null)}
                className="min-h-tap rounded-lg border border-border px-3 text-xs font-medium"
              >
                Kembali ke hasil otomatis
              </button>
              {/* Length delta, computed without a model: a big change is the
                  signal that content was dropped or invented, which is the
                  failure a reader skims past. */}
              <span className="text-[11px] text-fg-muted">
                {delta === 0 ? 'Panjang sama.' : `${delta > 0 ? '+' : ''}${delta} karakter`}
              </span>
            </>
          ) : null}
          {aiError ? <span className="text-[11px] text-danger">{aiError}</span> : null}
        </div>
      ) : null}

      {!changed ? (
        <p className="text-sm text-fg-muted">
          Tidak ada header Airway/Breathing/Circulation di bagian O — catatan ini sudah dalam
          format bangsal.
        </p>
      ) : (
        <>
          <ul className="mb-3 space-y-1 text-xs text-fg-muted">
            <li>{result.summary.vitals} tanda vital diangkat ke atas</li>
            <li>{result.summary.exam} baris pemeriksaan fisis</li>
            <li>{result.summary.investigations} blok penunjang dipindah ke bawah</li>
            {result.summary.unmatched > 0 ? (
              <li className="text-fg">
                {result.summary.unmatched} bagian tidak dikenali — dikumpulkan di
                “Lain-lain”, periksa sebelum menerapkan
              </li>
            ) : null}
          </ul>

          <div className="mb-1 flex items-center gap-2">
            <p className="flex-1 text-xs font-medium text-fg-muted">Pratinjau</p>
            {(
              [
                ['berdampingan', 'Berdampingan'],
                ['perubahan', 'Tandai perubahan'],
              ] as Array<['berdampingan' | 'perubahan', string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={[
                  'min-h-tap rounded-full border px-3 text-[11px]',
                  view === value
                    ? 'border-accent bg-bg-subtle font-medium text-accent'
                    : 'border-border text-fg-muted',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          {segments ? (
            <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-bg-subtle p-3 text-xs leading-relaxed">
              {segments.map((segment, index) => (
                <span
                  key={index}
                  className={
                    segment.type === 'insert'
                      ? 'bg-[var(--card-step-12-bg)] text-[var(--card-step-12-fg)]'
                      : segment.type === 'delete'
                        ? 'bg-[var(--card-step-1-bg)] text-[var(--card-step-1-fg)] line-through'
                        : undefined
                  }
                >
                  {segment.text}
                </span>
              ))}
            </pre>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="min-w-0">
                <p className="mb-1 text-[11px] font-semibold text-fg-muted">Sebelum</p>
                <pre className="max-h-[45vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-bg-subtle p-2 text-[11px] leading-relaxed">
                  {body}
                </pre>
              </div>
              <div className="min-w-0">
                <p className="mb-1 text-[11px] font-semibold text-fg-muted">Sesudah</p>
                <pre className="max-h-[45vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-bg-subtle p-2 text-[11px] leading-relaxed">
                  {result.body}
                </pre>
              </div>
            </div>
          )}

          <p className="mt-2 text-[11px] text-fg-faint">
            Tidak ada isi yang dibuang — bagian yang tidak dikenali tetap dibawa ke
            “Lain-lain”. Bila hasilnya tidak sesuai, versi sebelumnya ada di Riwayat
            perubahan.
          </p>
        </>
      )}
    </Sheet>
  );
}
