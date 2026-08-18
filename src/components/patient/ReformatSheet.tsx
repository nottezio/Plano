import { useMemo } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { cvcuToBangsal } from '@/domain/reformat/cvcuToBangsal';

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
  const result = useMemo(() => cvcuToBangsal(body), [body]);
  const changed = result.body !== body;

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
      {!changed ? (
        <p className="text-sm text-fg-muted">
          Tidak ada header Airway/Breathing/Circulation di bagian O — catatan ini sudah dalam
          format bangsal.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-fg-muted">
            {result.removed.length} header dihapus:{' '}
            <span className="text-fg">{result.removed.join(', ')}</span>. Isi di baris yang
            sama tetap ada, dan urutannya tidak berubah.
          </p>

          <p className="mb-1 text-xs font-medium text-fg-muted">Pratinjau</p>
          <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-bg-subtle p-3 text-xs leading-relaxed">
            {result.body}
          </pre>

          <p className="mt-2 text-[11px] text-fg-faint">
            Hanya header yang dihapus; tidak ada baris yang dipindah atau dibuang. Bila
            hasilnya tidak sesuai, versi sebelumnya ada di Riwayat perubahan.
          </p>
        </>
      )}
    </Sheet>
  );
}
