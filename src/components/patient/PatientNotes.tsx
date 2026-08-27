import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { updatePatient } from '@/data/repositories/patients.repo';
import { useTextSync, type TextSyncState } from '@/hooks/useTextSync';
import type { Patient } from '@/domain/types';

/**
 * SPEC F3 — the standing note.
 *
 * Belongs to the patient, not the day: never carried forward, never cleared at
 * midnight, never part of a SOAP entry. Allergies, family contact, access
 * lines, which consultant wants what — facts that stay true tomorrow.
 *
 * Kept off the daily note deliberately: a standing fact repeated into thirty
 * days of SOAP is thirty places to correct when it changes.
 *
 * Also NOT included in copy, and NOT in board search. What goes to the chief is
 * the day's report; this is a place to keep things for yourself.
 */

/**
 * The sync lives in a hook called ONCE by the page, because the panel is
 * rendered in two places — inline below `xl`, in the sidebar above it.
 *
 * Two components sharing a draft key each keep their own record of which writes
 * are still in flight, so each sees the other's write as a remote edit and the
 * two fight over the same text. One hook, two views, no argument.
 */
export function usePatientNotes(patient: Patient | null): TextSyncState {
  // Accepts null because hooks cannot sit behind the page's loading guard.
  const id = patient?.id ?? null;

  const write = useCallback(
    (notes: string) => (id ? updatePatient(id, { notes }) : Promise.resolve()),
    [id],
  );

  return useTextSync({
    key: `patient-notes|${id ?? 'none'}`,
    serverText: patient?.notes ?? '',
    locked: id === null,
    write,
  });
}

export function PatientNotes({ sync }: { sync: TextSyncState }): JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Height follows the content. `overflow-hidden` on the element keeps the
  // inner scrollbar from appearing for the instant before this runs.
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight}px`;
  }, [sync.value]);

  const [open, setOpen] = useState(false);
  const preview = sync.value.trim().split('\n')[0] ?? '';

  return (
    <section className="border-b border-border xl:border-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex min-h-tap w-full items-center gap-2 px-4 text-left xl:px-0"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-fg-muted">Catatan pasien</span>
          {!open ? (
            <span className="mt-0.5 block truncate text-[11px] text-fg-faint">
              {preview || 'Tidak hilang saat ganti hari.'}
            </span>
          ) : null}
        </span>
        <span aria-hidden="true" className="shrink-0 text-fg-faint">
          {open ? '−' : '+'}
        </span>
      </button>

      {open ? (
        <div className="px-4 pb-3 xl:px-0">
          {/*
            Grows with its content instead of scrolling inside five rows.
            
            A standing note is read at a glance — allergies, family contact, a
            DPJP's request — and a box that hides half of it behind an inner
            scrollbar defeats that. Height is set from `scrollHeight` on every
            change, the same way the SOAP editor does it.
          */}
          <textarea
            ref={ref}
            value={sync.value}
            onChange={(event) => sync.setValue(event.target.value)}
            onBlur={sync.flush}
            rows={3}
            placeholder="Alergi, kontak keluarga, akses, permintaan DPJP…"
            className="w-full resize-none overflow-hidden break-words rounded-lg border border-border bg-surface p-2 text-sm leading-relaxed outline-none placeholder:text-fg-faint"
          />
          <p className="mt-1 text-[11px] text-fg-faint">
            Berlaku untuk seluruh hari rawat dan tidak ikut tersalin ke laporan.
          </p>
        </div>
      ) : null}
    </section>
  );
}
