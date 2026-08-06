import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Sheet } from '@/components/common/Sheet';
import {
  archivePatient,
  reopenPatient,
  updatePatient,
} from '@/data/repositories/patients.repo';
import { ARCHIVE_REASON_LABELS } from '@/domain/archive';
import type { ArchiveReason, Patient } from '@/domain/types';

/**
 * SPEC F9 — archive, pin, delete.
 *
 * Archiving asks for a reason because the archive list is read months later,
 * when "why is this patient here" is the only question that matters. The reason
 * is required; the note is not.
 *
 * There is no delete action, by design. Archiving already removes the patient
 * from the board while keeping the record intact, so a second, lossier way to
 * do the same thing would only ever be a mis-tap risk.
 */
export function PatientActionsSheet({
  open,
  onOpenChange,
  patient,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient;
}): JSX.Element {
  const navigate = useNavigate();
  const [reason, setReason] = useState<ArchiveReason | null>(null);
  const [note, setNote] = useState('');

  const archived = patient.status === 'archived';

  const close = (): void => {
    setReason(null);
    setNote('');
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())} title={patient.name}>
      <div className="space-y-2">
        <Action
          label={patient.pinned ? 'Lepas sematan' : 'Sematkan di papan'}
          onClick={() => {
            void updatePatient(patient.id, { pinned: !patient.pinned });
            close();
          }}
        />

        {archived ? (
          <Action
            label="Aktifkan kembali"
            detail="Kembali muncul di papan pasien aktif."
            onClick={() => {
              void reopenPatient(patient.id);
              close();
            }}
          />
        ) : null}
      </div>

      {!archived ? (
        <section className="mt-5">
          <h3 className="text-sm font-semibold">Arsipkan</h3>
          <p className="mt-0.5 text-xs text-fg-muted">
            Hilang dari papan, tetap tersimpan lengkap dan tetap bisa disalin.
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(ARCHIVE_REASON_LABELS) as ArchiveReason[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setReason(value)}
                aria-pressed={reason === value}
                className={[
                  'min-h-tap rounded-full border px-3 text-xs',
                  reason === value
                    ? 'border-accent bg-bg-subtle font-medium text-accent'
                    : 'border-border text-fg-muted',
                ].join(' ')}
              >
                {ARCHIVE_REASON_LABELS[value]}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Catatan (opsional)"
            className="mt-2 min-h-tap w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none"
          />

          <button
            type="button"
            disabled={!reason}
            onClick={() => {
              if (!reason) return;
              void archivePatient(patient.id, reason, note);
              close();
              navigate('/');
            }}
            className="mt-2 min-h-tap w-full rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-40"
          >
            Arsipkan pasien
          </button>
        </section>
      ) : null}

    </Sheet>
  );
}

function Action({
  label,
  detail,
  onClick,
}: {
  label: string;
  detail?: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-border px-3 py-3 text-left"
    >
      <span className="block text-sm font-medium">{label}</span>
      {detail ? <span className="mt-0.5 block text-xs text-fg-muted">{detail}</span> : null}
    </button>
  );
}
