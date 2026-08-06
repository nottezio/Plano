import { useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { diffStats, keepBoth, type MergeOutcome } from '@/domain/merge/threeWayMerge';
import { DiffView } from './DiffView';

type Conflict = Extract<MergeOutcome, { kind: 'conflict' }>;

/**
 * SPEC 7.3 — "Versi berbeda terdeteksi".
 *
 * Four options, and one rule that outranks all of them: nothing is applied
 * until the user picks. The dialog cannot be dismissed into a silent choice,
 * so there is no close-to-cancel that quietly keeps one side.
 *
 * "Simpan keduanya" is deliberately last and deliberately ugly. It is the only
 * resolution that provably loses nothing, so it must always be reachable.
 */
export function ConflictDialog({
  conflict,
  otherDeviceLabel,
  onResolve,
}: {
  conflict: Conflict;
  otherDeviceLabel: string;
  onResolve: (body: string) => void;
}): JSX.Element {
  const [showDiff, setShowDiff] = useState(false);

  const localStats = diffStats(conflict.remote, conflict.local);
  const canAutoMerge = conflict.reason !== 'no-base';

  return (
    <Sheet
      open
      // Escape and the close button reopen nothing — a conflict must be
      // resolved, so dismissal falls back to keeping BOTH versions rather than
      // silently discarding one.
      onOpenChange={(open) => {
        if (!open) onResolve(keepBoth(conflict.local, conflict.remote, otherDeviceLabel));
      }}
      title="Versi berbeda terdeteksi"
      description={
        conflict.reason === 'no-base'
          ? 'Perangkat ini belum pernah melihat versi server untuk hari ini.'
          : 'Catatan ini diubah di perangkat lain saat Anda menulis.'
      }
    >
      <p className="text-xs text-fg-muted">
        Kedua versi sudah disimpan di riwayat perubahan sebelum pilihan diterapkan, jadi
        tidak ada yang hilang apa pun yang Anda pilih.
      </p>

      <div className="mt-4 space-y-2">
        {canAutoMerge ? (
          <Option
            title="Gabungkan otomatis"
            detail="Menggabungkan kedua perubahan; bagian yang bentrok ikut disertakan."
            onClick={() => onResolve(conflict.body)}
          />
        ) : null}

        <Option
          title="Pakai versi saya"
          detail={`Versi perangkat ini (+${localStats.added} / −${localStats.removed} karakter dibanding versi lain).`}
          onClick={() => onResolve(conflict.local)}
        />

        <Option
          title={`Pakai versi ${otherDeviceLabel}`}
          detail="Membuang perubahan yang belum tersimpan di perangkat ini."
          onClick={() => onResolve(conflict.remote)}
        />

        <Option
          title="Simpan keduanya"
          detail="Menyalin kedua versi ke dalam catatan, diberi penanda. Tidak ada yang hilang."
          onClick={() => onResolve(keepBoth(conflict.local, conflict.remote, otherDeviceLabel))}
        />
      </div>

      <button
        type="button"
        onClick={() => setShowDiff((current) => !current)}
        className="mt-4 text-xs text-accent underline"
      >
        {showDiff ? 'Sembunyikan perbedaan' : 'Lihat perbedaan'}
      </button>

      {showDiff ? (
        <div className="mt-2">
          <p className="mb-1 text-[11px] text-fg-faint">
            Hijau = ada di versi Anda, merah = ada di versi {otherDeviceLabel}.
          </p>
          <DiffView before={conflict.remote} after={conflict.local} />
        </div>
      ) : null}
    </Sheet>
  );
}

function Option({
  title,
  detail,
  onClick,
}: {
  title: string;
  detail: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-border px-3 py-3 text-left"
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className="mt-0.5 block text-xs text-fg-muted">{detail}</span>
    </button>
  );
}
