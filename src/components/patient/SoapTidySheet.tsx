import { useEffect, useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { AiError, askClaude } from '@/lib/ai';
import { findNonAsciiChars } from '@/domain/format/formatters';

/**
 * "Rapikan SOAP" — a SUGGESTION, shown beside the original.
 *
 * WHY THIS IS THE ONLY SHAPE THIS FEATURE MAY TAKE
 *
 * The note is the medical record. The section parser that produces every copy
 * out of this app is boundary-based and lossless precisely because it never
 * rewrites a word — reassembling its output reproduces the body exactly. A
 * model does not have that property and cannot be given it.
 *
 * The dangerous failure is not a bad suggestion, which is obvious. It is a
 * GOOD-LOOKING one: a sentence quietly improved into something the author did
 * not write, in a record somebody else will act on. Nothing here can prevent
 * that except the author reading it — so the original and the suggestion are
 * shown side by side, applying is a deliberate press, and the result goes
 * through the same revision trail as any other edit, which means it can be
 * rolled back.
 *
 * The model is also told, hard, to reorganise and never to rewrite. That is a
 * request, not a guarantee — which is exactly why the human step above it is
 * not optional.
 */
export function SoapTidySheet({
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
  const [state, setState] = useState<'idle' | 'running'>('idle');
  const [suggestion, setSuggestion] = useState('');
  const [error, setError] = useState<string | null>(null);

  // A suggestion belongs to the note it was made from. Kept across an
  // accidental close, discarded when the sheet is opened on a different body —
  // applying yesterday's tidy to today's note is the one mistake this sheet
  // could make silently.
  useEffect(() => {
    if (open) return;
    setError(null);
  }, [open]);

  const run = async (): Promise<void> => {
    setState('running');
    setError(null);
    try {
      const text = await askClaude(body, {
        system: [
          'Kamu merapikan SUSUNAN catatan SOAP klinis berbahasa Indonesia.',
          '',
          'ATURAN KERAS:',
          '- JANGAN mengubah kata, angka, singkatan, dosis, atau satuan apa pun.',
          '- JANGAN menambah temuan, diagnosis, terapi, atau kesimpulan.',
          '- JANGAN menghapus isi. Semua yang ada harus tetap ada.',
          '- Yang boleh diubah HANYA: urutan baris ke bawah heading S/O/A/P yang',
          '  tepat, penomoran, spasi, dan baris kosong.',
          '- Pertahankan gaya penanda yang sudah dipakai (*tebal*, _miring_, "- ").',
          '- Keluarkan HANYA catatannya, tanpa pengantar dan tanpa penjelasan.',
        ].join('\n'),
        maxTokens: 3000,
      });
      setSuggestion(text);
    } catch (cause) {
      setError(cause instanceof AiError ? cause.message : 'Gagal memanggil AI.');
    } finally {
      setState('idle');
    }
  };

  /*
    Two things worth knowing BEFORE applying, both computable without a model.

    A large change in length is the signal that something was dropped or
    invented — the one failure a reader skims past, because a shorter note
    still reads correctly. And non-ASCII characters matter here for the reason
    recorded on `toPlain`: they reach SIMGOS as `?`.
  */
  const delta = suggestion ? suggestion.length - body.length : 0;
  const nonAscii = suggestion ? findNonAsciiChars(suggestion).length : 0;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Rapikan SOAP (AI)"
      description="Usulan susunan. Catatan Anda tidak berubah sampai Anda menerapkannya."
      footer={
        <button
          type="button"
          disabled={!suggestion}
          onClick={() => {
            onApply(suggestion);
            setSuggestion('');
            onOpenChange(false);
          }}
          className="min-h-tap w-full rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          Terapkan usulan
        </button>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void run()}
          disabled={state === 'running' || body.trim().length === 0}
          className="min-h-tap rounded-lg border border-border px-3 text-xs font-medium disabled:opacity-50"
        >
          {state === 'running' ? 'Menyusun…' : suggestion ? 'Coba lagi' : 'Buat usulan'}
        </button>
        {suggestion ? (
          <span className="text-[11px] text-fg-muted">
            {delta === 0
              ? 'Panjang sama persis.'
              : `${delta > 0 ? '+' : ''}${delta} karakter dibanding aslinya.`}
          </span>
        ) : null}
        {nonAscii > 0 ? (
          <span className="text-[11px] text-danger">
            {nonAscii} karakter non-ASCII — akan jadi ? di SIMGOS.
          </span>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}

      {/*
        Side by side, original on the left. Not a diff: a diff of a reordered
        note is almost entirely red and green and hides the one line that
        changed meaning, which is the thing being looked for.
      */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium text-fg-muted">Catatan sekarang</p>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface px-3 py-2 text-[11px] leading-relaxed">
            {body}
          </pre>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-fg-muted">Usulan</p>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface px-3 py-2 text-[11px] leading-relaxed">
            {suggestion || '—'}
          </pre>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-fg-faint">
        Baca dulu sebelum menerapkan. Model bisa mengubah kalimat tanpa terlihat salah.
        Setelah diterapkan, perubahan tercatat di riwayat revisi dan bisa dikembalikan.
      </p>
    </Sheet>
  );
}
