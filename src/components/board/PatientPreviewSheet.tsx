import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Sheet } from '@/components/common/Sheet';
import { fetchEntryBodies } from '@/data/repositories/entries.repo';
import { formatShortDate } from '@/domain/clinicalDate';
import type { ClinicalDate, Patient } from '@/domain/types';

/**
 * Read the note without leaving the board.
 *
 * Scanning a round means opening a patient, reading four lines, going back,
 * and opening the next — and each of those is a route change that loses the
 * board's scroll position. This is the same information without the trip.
 *
 * READ-ONLY, deliberately. An editable box here would be a second live editor
 * on a screen already showing twenty patients, each with its own sync,
 * autosave and conflict handling — and the one thing worse than not being able
 * to edit from the board is editing the wrong patient from the board. The
 * "Buka" link is one tap away for anything beyond reading.
 *
 * The body is fetched when the sheet OPENS, not held on every card. Twenty
 * full notes in memory to show one is the kind of cost that only appears on
 * the ward, on a phone, on a long list.
 */
export function PatientPreviewSheet({
  patient,
  today,
  onOpenChange,
}: {
  patient: Patient | null;
  today: ClinicalDate;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  const [body, setBody] = useState<string | null>(null);
  const [date, setDate] = useState<ClinicalDate | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!patient) return;

    let cancelled = false;
    setLoading(true);
    setBody(null);
    setDate(null);

    void fetchEntryBodies(patient.id)
      .then((days) => {
        if (cancelled) return;
        /**
         * Today's note, or the most recent one that has content.
         *
         * Falling back matters more than it looks: a patient not yet seen this
         * morning has no note for today, and showing an empty box would say
         * "nothing written" when what is meant is "not yet today". Showing
         * yesterday's, labelled with its date, answers the question actually
         * being asked — what is going on with this patient.
         */
        const chosen = days.find((day) => day.date === today) ?? days[0];
        setBody(chosen?.body ?? '');
        setDate(chosen?.date ?? null);
      })
      .catch((error: unknown) => {
        console.error('[preview] could not read entries', error);
        if (!cancelled) setBody('');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [patient, today]);

  return (
    <Sheet
      open={patient !== null}
      onOpenChange={onOpenChange}
      title={patient?.name?.trim() || 'Pratinjau'}
      description={
        date
          ? date === today
            ? 'Catatan hari ini · hanya untuk dibaca'
            : `Catatan ${formatShortDate(date)} · hanya untuk dibaca`
          : 'Hanya untuk dibaca'
      }
    >
      <div className="p-4">
        {loading ? (
          <p className="py-8 text-center text-sm text-fg-muted">Memuat…</p>
        ) : body && body.trim().length > 0 ? (
          /**
           * `pre`, not the section-tinted editor.
           *
           * The mirror exists to line up with a textarea being typed into; on
           * a read-only excerpt it is machinery with nothing to align to.
           * Plain preformatted text also cannot drift from the note the way a
           * re-rendered version could.
           */
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-bg-subtle p-3 text-xs leading-relaxed">
            {body}
          </pre>
        ) : (
          <p className="py-8 text-center text-sm text-fg-muted">
            {date ? 'Catatan hari ini masih kosong.' : 'Belum ada catatan.'}
          </p>
        )}

        {patient ? (
          <Link
            to={`/p/${patient.id}`}
            className="mt-3 flex min-h-tap items-center justify-center rounded-lg border border-border text-sm font-medium text-accent"
          >
            Buka pasien
          </Link>
        ) : null}
      </div>
    </Sheet>
  );
}
