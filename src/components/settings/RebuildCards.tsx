import { useState } from 'react';

import { fetchEntryBodies } from '@/data/repositories/entries.repo';
import { buildPreview, updatePatient } from '@/data/repositories/patients.repo';
import { kjsRole } from '@/domain/board';
import { usePatients } from '@/hooks/usePatients';

/**
 * Rebuild the card fields that are cached on the patient document.
 *
 * WHY THIS HAS TO EXIST
 *
 * `preview` and `kjs` are denormalised: computed from the note body and stored
 * on the patient so the board can render twelve cards without reading twelve
 * note bodies. That is the right trade — but it means the cache is only ever
 * rebuilt by a WRITE, and a patient nobody has typed into since a rule changed
 * keeps the old answer forever.
 *
 * Two of those have now bitten:
 *
 *   `kjs` — the rule moved from the truncated preview to the whole body, so
 *           every existing patient still has no role at all and the badge does
 *           not appear on the patients it was built for.
 *   `preview` — the character limit went from 240 to 1600, and the `…` in the
 *           old string was saved, not rendered. No amount of resizing reveals
 *           text that was never stored.
 *
 * The alternative is waiting for each patient to be edited, which on an
 * archive of a hundred is never. So: one button, run when a rule changes.
 *
 * It reads the LATEST entry per patient rather than all of them. The card
 * shows one day, and reading every day of every patient would be hundreds of
 * documents to rebuild a field that describes one of them.
 */
export function RebuildCards(): JSX.Element {
  // Active and archived, not trashed: an archived patient is still opened and
  // copied from, so a stale card there is the same problem.
  const active = usePatients('active');
  const archived = usePatients('archived');
  const [state, setState] = useState<
    { phase: 'idle' } | { phase: 'running'; done: number; total: number } | { phase: 'done'; changed: number; failed: number }
  >({ phase: 'idle' });

  const run = async (): Promise<void> => {
    const list = [...active.patients, ...archived.patients];
    setState({ phase: 'running', done: 0, total: list.length });

    let changed = 0;
    let failed = 0;

    for (const [index, patient] of list.entries()) {
      try {
        const entries = await fetchEntryBodies(patient.id);
        const latest = entries.at(-1);
        if (latest?.body?.trim()) {
          const preview = buildPreview(latest.body);
          const kjs = kjsRole(latest.body);
          const fields: Record<string, unknown> = { preview };
          // Absence is not a correction — the same rule the write path
          // follows. A note that names nobody must not erase a role that was
          // set from a note that did.
          if (kjs) fields['kjs'] = kjs;
          await updatePatient(patient.id, fields as never);
          changed += 1;
        }
      } catch (error) {
        console.error('[rebuild] patient failed', patient.id, error);
        failed += 1;
      }
      setState({ phase: 'running', done: index + 1, total: list.length });
    }

    setState({ phase: 'done', changed, failed });
  };

  return (
    <div className="space-y-2 text-xs">
      <p className="text-fg-muted">
        Membaca catatan terakhir tiap pasien, lalu memperbarui ringkasan kartu dan penanda
        KJS. Tidak mengubah isi catatan.
      </p>

      {state.phase === 'running' ? (
        <p className="font-medium">
          Memproses {state.done}/{state.total}…
        </p>
      ) : null}

      {state.phase === 'done' ? (
        <p className="font-medium">
          Selesai — {state.changed} pasien diperbarui
          {state.failed > 0 ? `, ${state.failed} gagal` : ''}.
        </p>
      ) : null}

      <button
        type="button"
        disabled={state.phase === 'running'}
        onClick={() => void run()}
        className="min-h-tap rounded-lg border border-border px-3 font-medium text-fg-muted disabled:opacity-40"
      >
        Perbarui kartu pasien
      </button>
    </div>
  );
}
