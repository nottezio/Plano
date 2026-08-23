import { useEffect, useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { fillPatientFromNote } from '@/data/repositories/patients.repo';
import { parsePatientFacts } from '@/domain/parsePatient';
import { updatePatient } from '@/data/repositories/patients.repo';
import type { Patient, Sex } from '@/domain/types';

/**
 * SPEC F3, inverted.
 *
 * This used to be a create form that stood between the + button and a blank
 * page. It is now an OPTIONAL editor: a patient exists the moment you tap +,
 * and identity is something you fill in when you happen to know it — often
 * after the note is already written.
 *
 * Every field is optional, including the name. There is no Save button and no
 * validation gate, because there is nothing to validate: an empty record is a
 * legitimate state, and the board titles it from the note itself.
 */
export function IdentitySheet({
  open,
  onOpenChange,
  patient,
  body,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient;
  /** Today's note, for the fill-from-note action. */
  body: string;
}): JSX.Element {
  // Each field writes on change, like every other surface in the app.
  const patch = (next: Parameters<typeof updatePatient>[1]): void => {
    void updatePatient(patient.id, next).catch((error: unknown) =>
      console.error('[identity] write rejected', error),
    );
  };

  /**
   * Fill from the note on request.
   *
   * The same read the banner offers, reachable from where the fields are — so
   * someone correcting identity has the note's version one tap away instead of
   * retyping it. It fills blanks only, like every other derived value: a field
   * you typed is not overwritten by a parse.
   */
  const facts = parsePatientFacts(body);
  const canFill =
    (!patient.name?.trim() && Boolean(facts.name)) ||
    (!patient.mrn?.trim() && Boolean(facts.mrn)) ||
    (patient.age === undefined && facts.age !== undefined) ||
    (!patient.ward?.trim() && Boolean(facts.ward)) ||
    (!patient.room?.trim() && Boolean(facts.room)) ||
    (!patient.bed?.trim() && Boolean(facts.bed));

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Identitas pasien"
      description="Semua kolom opsional. Papan memakai baris pertama catatan bila nama kosong."
    >
      {canFill ? (
        <button
          type="button"
          onClick={() => {
            const written = fillPatientFromNote(patient, body);
            if (written) {
              void written.catch((error: unknown) =>
                console.error('[identity] fill rejected', error),
              );
            }
          }}
          className="mb-3 min-h-tap w-full rounded-lg border border-accent px-3 text-xs font-medium text-accent"
        >
          Ambil dari catatan hari ini
        </button>
      ) : null}

      <div className="space-y-3">
        <Field
          label="Nama"
          value={patient.name ?? ''}
          onChange={(name) => patch({ name })}
          autoFocus
        />

        <div className="grid grid-cols-2 gap-3">
          <Field label="No. RM" value={patient.mrn ?? ''} onChange={(mrn) => patch({ mrn })} />
          <Field
            label="Umur"
            inputMode="numeric"
            value={patient.age === undefined ? '' : String(patient.age)}
            onChange={(raw) => {
              const digits = raw.replace(/\D/g, '');
              patch({ age: digits ? Number(digits) : undefined });
            }}
          />
        </div>

        <div>
          <span className="mb-1 block text-xs text-fg-muted">Jenis kelamin</span>
          <div className="flex gap-2">
            {(['L', 'P'] as Sex[]).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={patient.sex === value}
                onClick={() => patch({ sex: patient.sex === value ? undefined : value })}
                className={[
                  'min-h-tap flex-1 rounded-lg border text-sm',
                  patient.sex === value
                    ? 'border-accent bg-bg-subtle font-medium text-accent'
                    : 'border-border text-fg-muted',
                ].join(' ')}
              >
                {value === 'L' ? 'Laki-laki' : 'Perempuan'}
              </button>
            ))}
          </div>
        </div>

        {/* Three fields, because they are written together and change apart:
            a transfer moves the room while the ward stays. */}
        <Field
          label="Ruang / Lantai"
          value={patient.ward ?? ''}
          onChange={(ward) => patch({ ward })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kamar" value={patient.room ?? ''} onChange={(room) => patch({ room })} />
          <Field label="Bed" value={patient.bed ?? ''} onChange={(bed) => patch({ bed })} />
        </div>

        <Field label="DPJP" value={patient.dpjp ?? ''} onChange={(dpjp) => patch({ dpjp })} />

        <Field
          label="Tanggal masuk"
          type="date"
          value={patient.admittedAt}
          onChange={(admittedAt) => {
            // Hari rawat counts from this, so an empty value would make every
            // day header meaningless. Ignore clears rather than storing one.
            if (admittedAt) patch({ admittedAt });
          }}
        />
      </div>
    </Sheet>
  );
}

/**
 * Typed text lives locally until the field is left.
 *
 * Binding `value` straight to the Firestore document made these fields
 * unusable: each keystroke wrote, and React re-rendered with the value the
 * server still held, so the character was erased before the echo arrived. The
 * same class of bug as the editor that undid every keystroke — a controlled
 * input whose source of truth is a round trip away.
 *
 * The draft follows the document while the field is idle, so a change made on
 * another device still shows up, and stops following it while you are typing.
 */
function Field({
  label,
  value,
  onChange,
  type = 'text',
  inputMode,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  type?: string;
  inputMode?: 'numeric';
  autoFocus?: boolean;
}): JSX.Element {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  return (
    <label className="block">
      <span className="mb-1 block text-xs text-fg-muted">{label}</span>
      <input
        type={type}
        value={draft}
        autoFocus={autoFocus}
        {...(inputMode ? { inputMode } : {})}
        onFocus={() => setEditing(true)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft !== value) onChange(draft);
        }}
        onKeyDown={(event) => {
          // Enter commits without leaving the sheet, which is how these get
          // filled in: a run of short fields, tabbed through.
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        className="min-h-tap w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none"
      />
    </label>
  );
}
