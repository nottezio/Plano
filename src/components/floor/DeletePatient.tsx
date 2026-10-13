import { useState } from 'react';

import { deleteRosterPatient } from '@/data/repositories/floors.repo';

/**
 * Hapus pasien (12.12, Avi): erase a patient from the floor's roster — the
 * denah, the list and every member's view — after a second tap. For a patient
 * entered by mistake or duplicated; a patient who went home is "Pulang", which
 * keeps the record and puts them in the Pulang/Pindah note.
 */
export function DeletePatient({
  floorId,
  patientKey,
  name,
  onDeleted,
  compact = false,
}: {
  floorId: string;
  patientKey: string;
  name: string;
  onDeleted?: (() => void) | undefined;
  compact?: boolean;
}): JSX.Element {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const base = 'min-h-tap rounded-lg border px-3 text-xs font-medium [@media(pointer:fine)]:min-h-8';
  if (!asking) {
    // Small and quiet on purpose (13.9, Avi): a big red button beside Pulang
    // was easy to hit by accident. Still two taps.
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        aria-label={`Hapus ${name} dari list`}
        className="h-7 shrink-0 rounded px-1.5 text-[11px] text-fg-faint underline-offset-2 hover:text-danger hover:underline"
      >
        Hapus
      </button>
    );
  }
  return (
    // On its own row (a header or a grid): the question never squeezes the title beside it.
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${compact ? 'order-last basis-full' : 'col-span-full'}`}>
      <span className="text-xs">Hapus {name} dari list?</span>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void deleteRosterPatient(floorId, patientKey)
            .then(() => onDeleted?.())
            .finally(() => setBusy(false));
        }}
        className={`${base} border-danger bg-danger text-white`}
      >
        {busy ? 'Menghapus…' : 'Ya, hapus'}
      </button>
      <button type="button" onClick={() => setAsking(false)} className={`${base} border-border`}>
        Batal
      </button>
    </span>
  );
}
