import { useMemo } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { cvcuToBangsal } from '@/domain/reformat/cvcuToBangsal';

/**
 * Reformat a CVCU note into the bangsal layout.
 *
 * Shown as a draft beside a count of what moved, and applied only when the user
 * presses the button. The transformation is a judgement — which lines are
 * vitals, which are examination, which are investigations — and a judgement
 * applied silently to a clinical note is not a feature.
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
  const result = useMemo(() => cvcuToBangsal(body), [body]);
  const changed = result.body !== body;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Ubah ke format bangsal"
      description="Menyusun ulang bagian O saja. Bagian lain tidak disentuh."
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
      {!changed ? (
        <p className="text-sm text-fg-muted">
          Catatan ini sudah dalam format bangsal, atau belum punya bagian O untuk disusun.
        </p>
      ) : (
        <>
          <ul className="mb-3 space-y-1 text-xs text-fg-muted">
            <li>{result.summary.vitals} baris tanda vital dikumpulkan ke atas</li>
            <li>{result.summary.exam} baris pemeriksaan fisis</li>
            <li>{result.summary.investigations} blok penunjang dipindah ke bawah</li>
            {result.summary.unrecognised > 0 ? (
              <li className="text-fg">
                {result.summary.unrecognised} baris tidak dikenali — tetap disertakan, periksa
                posisinya
              </li>
            ) : null}
          </ul>

          <p className="mb-1 text-xs font-medium text-fg-muted">Pratinjau</p>
          <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-bg-subtle p-3 text-xs leading-relaxed">
            {result.body}
          </pre>

          <p className="mt-2 text-[11px] text-fg-faint">
            Tidak ada isi yang dibuang — baris yang tidak dikenali tetap dibawa. Bila hasilnya
            tidak sesuai, versi sebelumnya ada di Riwayat perubahan.
          </p>
        </>
      )}
    </Sheet>
  );
}
