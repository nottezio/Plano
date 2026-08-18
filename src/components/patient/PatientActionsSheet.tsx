import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Sheet } from '@/components/common/Sheet';
import {
  archivePatient,
  deletePatient,
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
 * Archive and delete are both offered, and they are not the same thing:
 * archiving keeps the record readable and copyable, deleting removes it from
 * every list. Delete is therefore two taps behind a confirm, and is still a
 * SOFT delete at the data layer — the rules deny hard deletion outright.
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
  const [confirmDelete, setConfirmDelete] = useState(false);

  const archived = patient.status === 'archived';

  const close = (): void => {
    setReason(null);
    setNote('');
    setConfirmDelete(false);
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

      {/* Discharge planning, kept above archiving: it is the step before, and
          the two get confused if they sit together. */}
      <section className="mt-5">
        <h3 className="text-sm font-semibold">Rencana pulang</h3>
        <div className="mt-2 flex gap-2">
          {(
            [
              [undefined, 'Belum'],
              ['h1', 'H-1 pulang'],
              ['today', 'Pulang hari ini'],
            ] as Array<[Patient['discharge'], string]>
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={patient.discharge === value}
              onClick={() => void updatePatient(patient.id, { discharge: value })}
              className={[
                'min-h-tap flex-1 rounded-lg border px-2 text-xs',
                patient.discharge === value
                  ? 'border-accent bg-bg-subtle font-medium text-accent'
                  : 'border-border text-fg-muted',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-fg-faint">
          Ditandai di papan sampai diubah — tidak hilang saat ganti hari.
        </p>
      </section>

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

      <section className="mt-6 border-t border-border pt-4">
        {confirmDelete ? (
          <>
            <p className="text-xs text-fg-muted">
              Hapus {patient.name?.trim() || 'catatan ini'}? Catatan akan hilang dari papan
              dan arsip. Gunakan Arsipkan bila hanya ingin menyelesaikan pasien.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="min-h-tap flex-1 rounded-lg border border-border text-sm"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  void deletePatient(patient.id);
                  close();
                  navigate('/');
                }}
                className="min-h-tap flex-1 rounded-lg border border-danger text-sm font-medium text-danger"
              >
                Hapus
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="min-h-tap w-full rounded-lg border border-border px-3 text-sm text-danger"
          >
            Hapus pasien
          </button>
        )}
      </section>
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
