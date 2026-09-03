import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Sheet } from '@/components/common/Sheet';
import {
  archivePatient,
  setPatientStatus,
  reopenPatient,
  updatePatient,
} from '@/data/repositories/patients.repo';
import { ARCHIVE_REASON_LABELS } from '@/domain/archive';
import { dateForStage, migrateLegacyDischarge } from '@/domain/discharge';
import { useClinicalToday } from '@/hooks/useClinicalToday';
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
  onAddShiftNote,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient;
  /** Adds an empty shift note to the day on screen. Absent when the day is locked. */
  onAddShiftNote?: (() => void) | undefined;
}): JSX.Element {
  const today = useClinicalToday();
  const planned = migrateLegacyDischarge(patient, today);

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
          label={patient.temporary ? 'Jadikan pasien saya' : 'Tandai sebagai titipan'}
          detail={
            patient.temporary
              ? 'Pindah ke daftar pasien saya.'
              : 'Pindah ke daftar Titipan — untuk pasien yang dijaga sementara.'
          }
          onClick={() => {
            void updatePatient(patient.id, { temporary: !patient.temporary });
            close();
          }}
        />
        {/*
          The way a shift note gets created.
          
          Here rather than as a permanently visible "+ SOAP jaga" panel under
          the note: the panel would cost a row on every patient on every round
          to serve the few days that have a jaga complaint. Adding one is
          occasional; reading one is not, so the BOXES are always visible once
          they exist and only the button is behind a tap.
        */}
        {onAddShiftNote ? (
          <Action
            label="Tambah SOAP jaga"
            detail="Kotak kosong di bawah SOAP hari ini, untuk keluhan saat jaga."
            onClick={() => {
              onAddShiftNote();
              close();
            }}
          />
        ) : null}

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
          <button
            type="button"
            aria-pressed={!planned}
            onClick={() => void updatePatient(patient.id, { dischargePlannedFor: undefined })}
            className={[
              'min-h-tap flex-1 rounded-lg border px-2 text-xs',
              !planned
                ? 'border-accent bg-bg-subtle font-medium text-accent'
                : 'border-border text-fg-muted',
            ].join(' ')}
          >
            Belum
          </button>
          {(['h1', 'today'] as const).map((stage) => {
            const date = dateForStage(stage, today);
            return (
              <button
                key={stage}
                type="button"
                aria-pressed={planned === date}
                onClick={() =>
                  void updatePatient(patient.id, { dischargePlannedFor: date })
                }
                className={[
                  'min-h-tap flex-1 rounded-lg border px-2 text-xs',
                  planned === date
                    ? 'border-accent bg-bg-subtle font-medium text-accent'
                    : 'border-border text-fg-muted',
                ].join(' ')}
              >
                {stage === 'h1' ? 'H-1 pulang' : 'Pulang hari ini'}
              </button>
            );
          })}
        </div>

        {/* The date is the stored value, so it is also editable directly —
            a discharge four days out is a real plan, and the two buttons above
            only cover the last two days of it. */}
        <label className="mt-2 block">
          <span className="mb-1 block text-[11px] text-fg-muted">Tanggal pulang</span>
          <input
            type="date"
            value={planned ?? ''}
            onChange={(event) =>
              void updatePatient(patient.id, {
                dischargePlannedFor: event.target.value
                  ? (event.target.value as typeof planned)
                  : undefined,
              })
            }
            className="min-h-tap w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none"
          />
        </label>

        <p className="mt-1 text-[11px] text-fg-faint">
          Disimpan sebagai tanggal, bukan status — jadi H-1 hari ini otomatis menjadi
          &ldquo;pulang hari ini&rdquo; besok pagi.
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
              Pindahkan {patient.name?.trim() || 'catatan ini'} ke sampah? Bisa dipulihkan
              dari Arsip sampai sampah dikosongkan. Gunakan Arsipkan bila hanya ingin
              menyelesaikan pasien.
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
                  /**
                   * To the TRASH, not `deletePatient`.
                   *
                   * `deletePatient` sets `deletedAt`, which is a different
                   * mechanism from the trash added for the board — so deleting
                   * from inside a patient made it vanish without appearing in
                   * the trash, and the only way back was an export. Two ways to
                   * delete that land in different places is one too many.
                   */
                  void setPatientStatus(patient.id, 'trashed');
                  close();
                  navigate('/');
                }}
                className="min-h-tap flex-1 rounded-lg border border-danger text-sm font-medium text-danger"
              >
                Ke sampah
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
