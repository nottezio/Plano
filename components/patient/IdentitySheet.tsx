import { Sheet } from '@/components/common/Sheet';
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient;
}): JSX.Element {
  // Each field writes on change, like every other surface in the app.
  const patch = (next: Parameters<typeof updatePatient>[1]): void => {
    void updatePatient(patient.id, next).catch((error: unknown) =>
      console.error('[identity] write rejected', error),
    );
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Identitas pasien"
      description="Semua kolom opsional. Papan memakai baris pertama catatan bila nama kosong."
    >
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="Ruang" value={patient.ward ?? ''} onChange={(ward) => patch({ ward })} />
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
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-fg-muted">{label}</span>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        {...(inputMode ? { inputMode } : {})}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-tap w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none"
      />
    </label>
  );
}
