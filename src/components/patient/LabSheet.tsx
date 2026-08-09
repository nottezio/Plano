import { useMemo, useRef, useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { labHeading, parseLab } from '@/domain/lab/parseLab';
import { copyText } from '@/lib/clipboard';
import { formatShortDate } from '@/domain/clinicalDate';
import type { ClinicalDate } from '@/domain/types';

/**
 * Lab reformatter.
 *
 * Paste the lab text, get the compact handover lines, insert them into the note
 * under a dated heading.
 *
 * The flow is deliberately paste-then-check rather than image-straight-to-note.
 * OCR of a lab table is not reliable enough to trust unseen — a misread digit
 * in a potassium value is not recoverable by reading the note back, because the
 * wrong number looks exactly as plausible as the right one. So whatever the
 * source, the extracted text lands in an editable box first, and the formatted
 * preview updates as you correct it. Nothing enters the note until you press
 * insert.
 */
export function LabSheet({
  open,
  onOpenChange,
  date,
  onInsert,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: ClinicalDate;
  onInsert: (text: string) => void;
}): JSX.Element {
  const [raw, setRaw] = useState('');
  const [source, setSource] = useState('Laboratorium');
  const [ocrState, setOcrState] = useState<'idle' | 'running' | 'failed'>('idle');
  const fileRef = useRef<HTMLInputElement>(null);

  const result = useMemo(() => parseLab(raw), [raw]);
  const heading = labHeading(formatShortDate(date), source.trim() || 'Laboratorium');
  const block = result.formatted ? `${heading}\n${result.formatted}` : '';

  /**
   * OCR is loaded on demand from a CDN, never bundled.
   *
   * The language data is several megabytes — precaching it would multiply the
   * size of an app whose main promise is working on hospital wifi, in exchange
   * for a feature used occasionally and only when online. If it cannot load,
   * the paste box is still there and still works.
   */
  const runOcr = async (file: File): Promise<void> => {
    setOcrState('running');
    try {
      // Typed loosely and loaded by URL: this module is intentionally not a
      // dependency of the build, so there are no types to import.
      const url = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/+esm';
      const tesseract = (await import(/* @vite-ignore */ url)) as {
        recognize: (image: File, lang: string) => Promise<{ data: { text: string } }>;
      };
      const { data } = await tesseract.recognize(file, 'eng');
      setRaw((current) => (current ? `${current}\n${data.text}` : data.text));
      setOcrState('idle');
    } catch (error) {
      console.error('[lab] OCR failed', error);
      setOcrState('failed');
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Format hasil lab"
      description="Tempel teks hasil lab, periksa, lalu sisipkan ke catatan."
      footer={
        <button
          type="button"
          disabled={!block}
          onClick={() => {
            onInsert(block);
            setRaw('');
            onOpenChange(false);
          }}
          className="min-h-tap w-full rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          Sisipkan ke catatan
        </button>
      }
    >
      <label className="block">
        <span className="mb-1 block text-xs text-fg-muted">Judul blok</span>
        <input
          type="text"
          value={source}
          onChange={(event) => setSource(event.target.value)}
          placeholder="Laboratorium PJT"
          className="min-h-tap w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none"
        />
      </label>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={ocrState === 'running'}
          className="min-h-tap rounded-lg border border-border px-3 text-xs disabled:opacity-50"
        >
          {ocrState === 'running' ? 'Membaca gambar…' : 'Ambil dari gambar'}
        </button>
        <span className="text-[11px] text-fg-faint">Perlu koneksi. Hasil wajib diperiksa.</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void runOcr(file);
            event.target.value = '';
          }}
        />
      </div>

      {ocrState === 'failed' ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          Gagal membaca gambar. Tempel teksnya secara manual di bawah.
        </p>
      ) : null}

      <label className="mt-3 block">
        <span className="mb-1 block text-xs text-fg-muted">Teks hasil lab</span>
        <textarea
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          rows={8}
          spellCheck={false}
          placeholder={'WBC 6.01 4.00 - 10.0\nHGB 12.4 12.0 - 16.0\nNatrium 132 136 - 145'}
          className="w-full rounded-lg border border-border bg-surface p-2 font-mono text-xs leading-relaxed outline-none"
        />
      </label>

      <p className="mb-1 mt-4 text-xs font-medium text-fg-muted">Hasil</p>
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-bg-subtle p-3 text-xs leading-relaxed">
        {block || '(belum ada nilai yang terbaca)'}
      </pre>

      {result.unknown.length > 0 ? (
        <p className="mt-2 text-[11px] text-fg-faint">
          {result.unknown.length} nilai tidak dikenali dan dimasukkan ke “Lain-lain”. Periksa
          kembali sebelum menyisipkan.
        </p>
      ) : null}

      {block ? (
        <button
          type="button"
          onClick={() => void copyText(block)}
          className="mt-2 min-h-tap text-xs text-accent underline"
        >
          Salin saja
        </button>
      ) : null}
    </Sheet>
  );
}
