import { useState, type ReactNode } from 'react';
import { DateField } from '@/components/common/DateField';
import { useNavigate } from 'react-router-dom';

import { Sheet } from '@/components/common/Sheet';
import {
  archivePatient,
  clearTransfer,
  sendPatient,
  setPatientStatus,
  reopenPatient,
  updatePatient,
} from '@/data/repositories/patients.repo';
import { transferTarget } from '@/domain/transfer';
import { useSession } from '@/store/useSession';
import { ARCHIVE_REASON_LABELS } from '@/domain/archive';
import { dateForStage, migrateLegacyDischarge, usulDays, usulOpen } from '@/domain/discharge';
import { useClinicalToday } from '@/hooks/useClinicalToday';
import type { ArchiveReason, Patient } from '@/domain/types';
import { ReminderPicker } from './ReminderPicker';
import {
  IconCalculator,
  IconChevronRight,
  IconColumns,
  IconConvert,
  IconEye,
  IconFlask,
  IconHandoff,
  IconLayers,
  IconMoon,
  IconPin,
  IconPrinter,
  IconQuote,
  IconReopen,
  IconSparkle,
  IconTrash,
} from '@/components/common/Icons';
import {
  Button,
  Callout,
  ChipRow,
  ChoiceChip,
  Field,
  INPUT,
  ListGroup,
  ListRow,
  Section,
  Segmented,
} from '@/components/common/ui';

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
  onAddVersion,
  onLab,
  onOpening,
  onCompare,
  onCalculator,
  onTidy,
  onReformat,
  onSummarise,
  onExportWord,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient;
  /** Adds an empty shift note to the day on screen. Absent when the day is locked. */
  onAddShiftNote?: (() => void) | undefined;
  /** Make a named version of the day's SOAP; absent on a locked or empty day. */
  onAddVersion?: (() => void) | undefined;
  /*
   * The three header actions that no longer fit on a phone.
   *
   * Listed here ALWAYS, not only below the breakpoint. A control that exists
   * on one screen width and not another is a control nobody learns, and this
   * sheet is where "everything else you can do to this patient" already
   * lives — the header buttons are the shortcut, not the home.
   *
   * Each is optional for the same reason `onAddShiftNote` is: on a locked day
   * there is nothing to open a lab sheet or an opening block for, and an
   * inert row is worse than an absent one.
   */
  onLab?: (() => void) | undefined;
  onOpening?: (() => void) | undefined;
  onCompare?: (() => void) | undefined;
  /** Opens the floating calculator; listed here on a phone, where the header has no room for it. */
  onCalculator?: (() => void) | undefined;
  /**
   * Present only when the AI switch is on AND a key exists AND there is a note
   * to tidy. Absent otherwise: a greyed-out row for a feature nobody enabled
   * advertises sending a patient's note off the device.
   */
  onTidy?: (() => void) | undefined;
  /** CVCU → bangsal. Present only where the header has dropped the button. */
  onReformat?: (() => void) | undefined;
  /**
   * Summarise the whole admission for a consultant. Available on a LOCKED day
   * too, unlike the other AI actions — a locked note is one you are reading
   * out rather than editing, which is exactly when this is wanted.
   */
  onSummarise?: (() => void) | undefined;
  /**
   * The note on screen as a Word file, for printing. Offered on a LOCKED day
   * too: printing an older note is reading it, not changing it. Absent only
   * when the note is empty.
   */
  onExportWord?: (() => void) | undefined;
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

  const description = [patient.mrn ? `RM ${patient.mrn}` : null, patient.ward?.trim() || null]
    .filter(Boolean)
    .join(' · ');
  const h1 = dateForStage('h1', today);
  const dischargeToday = dateForStage('today', today);
  const usul = usulOpen(patient);
  const dischargeStage = usul
    ? 'usul'
    : !planned
      ? 'none'
      : planned === h1
        ? 'h1'
        : planned === dischargeToday
          ? 'today'
          : 'custom';
  const run = (action: () => void): void => {
    close();
    action();
  };
  // Daily rows first; the rest of the note features and the AI rows fold
  // away so the sheet opens on what a round actually uses.
  const hasDailyTools = Boolean(onLab || onAddShiftNote || onCompare || onCalculator);
  const hasMoreTools = Boolean(onExportWord || onOpening || onAddVersion || onReformat || onSummarise || onTidy);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title={patient.name?.trim() || 'Pasien'}
      {...(description ? { description } : {})}
    >
      <div className="space-y-6">
        {/*
          States of the PATIENT, shown as switches: the row says what is true
          now, not only what tapping it would do.
        */}
        <Section title="Pasien">
          <ListGroup>
            <ListRow
              icon={<IconEye width={18} height={18} />}
              title="Pemantauan"
              detail="Menandai kartu pasien di papan."
              onClick={() => {
                void updatePatient(patient.id, { pemantauan: !patient.pemantauan });
                close();
              }}
              trailing={<SwitchMark on={Boolean(patient.pemantauan)} />}
            />
            <ListRow
              icon={<IconHandoff width={18} height={18} />}
              title="Titipan"
              detail="Pasien yang dijaga sementara, di daftar Titipan."
              onClick={() => {
                void updatePatient(patient.id, { temporary: !patient.temporary });
                close();
              }}
              trailing={<SwitchMark on={Boolean(patient.temporary)} />}
            />
            <ListRow
              icon={<IconPin width={18} height={18} />}
              title="Pin di papan"
              detail="Kartu tetap di urutan atas."
              onClick={() => {
                void updatePatient(patient.id, { pinned: !patient.pinned });
                close();
              }}
              trailing={<SwitchMark on={Boolean(patient.pinned)} />}
            />
            {archived ? (
              <ListRow
                icon={<IconReopen width={18} height={18} />}
                title="Aktifkan kembali"
                detail="Kembali muncul di papan pasien aktif."
                onClick={() => {
                  void reopenPatient(patient.id);
                  close();
                }}
              />
            ) : null}
          </ListGroup>
        </Section>

        {hasDailyTools ? (
          <Section title="Catatan">
            <ListGroup>
              {onLab ? (
                <ListRow
                  icon={<IconFlask width={18} height={18} />}
                  title="Format hasil lab"
                  detail="Dari PDF lab atau teks tempelan, jadi blok berjudul dan bertanggal."
                  onClick={() => run(onLab)}
                />
              ) : null}
              {onAddShiftNote ? (
                <ListRow
                  icon={<IconMoon width={18} height={18} />}
                  title="Tambah SOAP jaga"
                  detail="Format S/O/A/P jaga, jam bisa diubah."
                  onClick={() => run(onAddShiftNote)}
                />
              ) : null}
              {onCompare ? (
                <ListRow
                  icon={<IconColumns width={18} height={18} />}
                  title="Bandingkan catatan"
                  detail="Dengan hari sebelumnya, SOAP asli, atau versi lain."
                  onClick={() => run(onCompare)}
                />
              ) : null}
              {onCalculator ? (
                <ListRow
                  icon={<IconCalculator width={18} height={18} />}
                  title="Kalkulator"
                  detail="Hitung sambil menulis; panelnya melayang di atas catatan."
                  onClick={() => run(onCalculator)}
                />
              ) : null}
            </ListGroup>
          </Section>
        ) : null}

        {hasMoreTools ? (
          <Disclosure title="Catatan lainnya">
            <ListGroup>
              {onExportWord ? (
                <ListRow
                  icon={<IconPrinter width={18} height={18} />}
                  title="Ekspor ke Word"
                  detail="Catatan yang terbuka sebagai .docx A4 untuk dicetak; tebal/miring dan poin ikut."
                  onClick={() => run(onExportWord)}
                />
              ) : null}
              {onOpening ? (
                <ListRow
                  icon={<IconQuote width={18} height={18} />}
                  title="Pembuka & penutup"
                  detail="Ganti salam, kalimat pembuka, sapaan Prof/dokter, atau penutup."
                  onClick={() => run(onOpening)}
                />
              ) : null}
              {onAddVersion ? (
                <ListRow
                  icon={<IconLayers width={18} height={18} />}
                  title="Buat versi SOAP"
                  detail="Salinan untuk diedit (mis. untuk dr. AHA); SOAP aslinya tidak berubah."
                  onClick={() => run(onAddVersion)}
                />
              ) : null}
              {onReformat ? (
                <ListRow
                  icon={<IconConvert width={18} height={18} />}
                  title="Ubah ke format bangsal"
                  detail="Menghapus header Airway/Breathing/Circulation dst."
                  onClick={() => run(onReformat)}
                />
              ) : null}
              {onSummarise ? (
                <ListRow
                  icon={<IconSparkle width={18} height={18} />}
                  title="Ringkas perjalanan pasien"
                  detail="Untuk dibacakan ke DPJP. Tidak masuk ke catatan."
                  onClick={() => run(onSummarise)}
                />
              ) : null}
              {onTidy ? (
                <ListRow
                  icon={<IconSparkle width={18} height={18} />}
                  title="Rapikan SOAP"
                  detail="Tebal/miring dan urutan penunjang. Ditampilkan berdampingan dulu."
                  onClick={() => run(onTidy)}
                />
              ) : null}
            </ListGroup>
          </Disclosure>
        ) : null}

        <Section
          title="Pengingat harian"
          hint={'Muncul di kartu pasien dan bisa dicentang saat selesai. "Hari ini" hilang sendiri besok.'}
        >
          <ReminderPicker patient={patient} today={today} />
        </Section>

        {/* Discharge planning, kept above archiving: it is the step before, and
            the two get confused if they sit together. */}
        <Section
          title="Rencana pulang"
          hint="Disimpan sebagai tanggal, bukan status: H-1 hari ini otomatis menjadi “pulang hari ini” besok pagi."
        >
          <Segmented
            label="Rencana pulang"
            value={dischargeStage}
            onChange={(stage) => {
              if (stage === 'custom') return;
              // An usul is a proposal: it holds no date. Any decision closes it.
              void updatePatient(
                patient.id,
                stage === 'usul'
                  ? { usulH1: today, dischargePlannedFor: undefined, discharge: undefined }
                  : {
                      usulH1: undefined,
                      dischargePlannedFor: stage === 'none' ? undefined : dateForStage(stage, today),
                    },
              );
            }}
            options={[
              ['none', 'Belum'],
              ['usul', 'Usul H-1'],
              ['h1', 'H-1 pulang'],
              ['today', 'Pulang hari ini'],
            ]}
          />
          {usul && patient.usulH1 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-bg-subtle px-3 py-2 text-xs text-fg">
              <span className="min-w-0 flex-1">
                <strong>Usul H-1</strong> · {usulDays(patient.usulH1, today) > 0 ? `sejak ${usulDays(patient.usulH1, today)} hari` : 'hari ini'} · menunggu keputusan DPJP
              </span>
              <Button
                size="sm"
                onClick={() => void updatePatient(patient.id, { usulH1: undefined, dischargePlannedFor: h1 })}
              >
                Jadikan H-1
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void updatePatient(patient.id, { usulH1: undefined })}>
                Batalkan usul
              </Button>
            </div>
          ) : null}
          {/* The date is the stored value, so it is also editable directly —
              a discharge four days out is a real plan. */}
          <Field label="Tanggal pulang" htmlFor="discharge-date">
            <DateField
              id="discharge-date"
              value={planned ?? ''}
              allowEmpty
              onChange={(next) =>
                void updatePatient(patient.id, {
                  dischargePlannedFor: next ? (next as typeof planned) : undefined,
                  ...(next ? { usulH1: undefined } : {}),
                })
              }
            />
          </Field>
        </Section>

        {!archived ? (
          <Section title="Arsipkan" hint="Hilang dari papan, tetap tersimpan lengkap dan tetap bisa disalin.">
            <ChipRow>
              {(Object.keys(ARCHIVE_REASON_LABELS) as ArchiveReason[]).map((value) => (
                <ChoiceChip key={value} active={reason === value} onClick={() => setReason(value)}>
                  {ARCHIVE_REASON_LABELS[value]}
                </ChoiceChip>
              ))}
            </ChipRow>
            <input
              type="text"
              aria-label="Catatan arsip"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Catatan (opsional)"
              className={INPUT}
            />
            <Button
              variant="primary"
              full
              disabled={!reason}
              onClick={() => {
                if (!reason) return;
                void archivePatient(patient.id, reason, note);
                close();
                navigate('/');
              }}
            >
              {reason ? `Arsipkan · ${ARCHIVE_REASON_LABELS[reason]}` : 'Pilih alasan untuk mengarsipkan'}
            </Button>
          </Section>
        ) : null}

        <SendToColleague patient={patient} />

        <Disclosure title="Zona berbahaya" open={confirmDelete}>
          {confirmDelete ? (
            <Callout
              tone="danger"
              role="alert"
              title={`Pindahkan ${patient.name?.trim() || 'catatan ini'} ke sampah?`}
            >
              <p>
                Bisa dipulihkan dari Arsip sampai sampah dikosongkan. Gunakan Arsipkan bila hanya
                ingin menyelesaikan pasien.
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => setConfirmDelete(false)}>
                  Batal
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    /**
                     * To the TRASH, not `deletePatient`: `deletedAt` is a
                     * different mechanism, and deleting from here made the
                     * patient vanish without appearing in the trash.
                     */
                    void setPatientStatus(patient.id, 'trashed');
                    close();
                    navigate('/');
                  }}
                >
                  Ke sampah
                </Button>
              </div>
            </Callout>
          ) : (
            <ListGroup>
              <ListRow
                icon={<IconTrash width={18} height={18} />}
                tone="danger"
                title="Hapus pasien"
                detail="Ke sampah; bisa dipulihkan sampai sampah dikosongkan."
                onClick={() => setConfirmDelete(true)}
              />
            </ListGroup>
          )}
        </Disclosure>
      </div>
    </Sheet>
  );
}

/**
 * Handover to a colleague (see `domain/transfer`). Sending only marks the
 * patient; it moves when they accept on their board, and until then it stays
 * here and can be cancelled.
 */
function SendToColleague({ patient }: { patient: Patient }): JSX.Element {
  const user = useSession((state) => state.user);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (patient.transferTo) {
    return (
      <Section title="Kirim ke rekan">
        <Callout
          tone="info"
          role="status"
          title={`Menunggu diterima oleh ${patient.transferTo}`}
          action={
            <Button size="sm" onClick={() => void clearTransfer(patient.id)}>
              Batalkan
            </Button>
          }
        >
          Pasien pindah ke papan rekan setelah ia menekan Terima.
        </Callout>
      </Section>
    );
  }

  const send = (): void => {
    if (!user) return;
    const target = transferTarget(email, user.email);
    if ('error' in target) {
      setError(target.error);
      return;
    }
    setError(null);
    setEmail('');
    void sendPatient(patient.id, target.email, {
      uid: user.uid,
      name: user.displayName?.trim() || user.email || 'Rekan',
    }).catch((e: unknown) => {
      console.error('[transfer] send failed', e);
      setError('Gagal mengirim. Coba lagi.');
    });
  };

  return (
    <Disclosure title="Kirim ke rekan">
      <div className="space-y-2">
        <p className="text-xs text-fg-muted">
          Untuk serah terima. Setelah rekan menerima, pasien beserta semua catatannya pindah ke
          papannya dan hilang dari papan Anda.
        </p>
        <Field label="Email Google rekan" htmlFor="transfer-email">
          <input
            id="transfer-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') send();
            }}
            placeholder="nama@gmail.com"
            className={INPUT}
          />
        </Field>
        {error ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}
        <Button variant="primary" full disabled={!email.trim()} onClick={send}>
          Kirim pasien
        </Button>
      </div>
    </Disclosure>
  );
}

/** The look of a switch, inside a row that is itself the button. */
function SwitchMark({ on }: { on: boolean }): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={[
        'relative h-6 w-10 shrink-0 rounded-full transition-colors',
        on ? 'bg-accent' : 'bg-border',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all',
          on ? 'left-[1.125rem]' : 'left-0.5',
        ].join(' ')}
      />
    </span>
  );
}

/**
 * A folded group, styled like a Section title. Native <details>, so it is
 * keyboard- and screen-reader-operable with no state of its own.
 */
function Disclosure({
  title,
  open,
  children,
}: {
  title: string;
  open?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <details className="group" {...(open ? { open: true } : {})}>
      <summary className="flex min-h-tap cursor-pointer list-none items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-fg-muted [&::-webkit-details-marker]:hidden">
        <span className="flex-1">{title}</span>
        <IconChevronRight width={16} height={16} className="transition-transform group-open:rotate-90" />
      </summary>
      <div className="pt-2">{children}</div>
    </details>
  );
}
