import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Sheet } from '@/components/common/Sheet';
import { createPatient } from '@/data/repositories/patients.repo';
import type { ClinicalDate, Sex } from '@/domain/types';
import { useSession } from '@/store/useSession';

/**
 * SPEC F3 — creating a patient must succeed in airplane mode.
 *
 * The id is generated on device and the navigation happens immediately; the
 * write promise is deliberately NOT awaited, because awaiting it offline would
 * hang the sheet open forever while Firestore holds the mutation in its queue.
 */
export function CreatePatientSheet({
  open,
  onOpenChange,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  today: ClinicalDate;
}): JSX.Element {
  const uid = useSession((state) => state.user?.uid ?? null);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [mrn, setMrn] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex | ''>('');
  const [ward, setWard] = useState('');
  const [bed, setBed] = useState('');
  const [dpjp, setDpjp] = useState('');
  const [diagnoses, setDiagnoses] = useState('');
  const [labels, setLabels] = useState('');
  const [admittedAt, setAdmittedAt] = useState<ClinicalDate>(today);

  const reset = (): void => {
    setName('');
    setMrn('');
    setAge('');
    setSex('');
    setWard('');
    setBed('');
    setDpjp('');
    setDiagnoses('');
    setLabels('');
    setAdmittedAt(today);
  };

  const submit = (): void => {
    if (!uid || !name.trim()) return;

    const parsedAge = Number.parseInt(age, 10);
    const { id, written } = createPatient(uid, {
      name,
      admittedAt,
      ...(mrn.trim() ? { mrn: mrn.trim() } : {}),
      ...(Number.isFinite(parsedAge) ? { age: parsedAge } : {}),
      ...(sex ? { sex } : {}),
      ...(ward.trim() ? { ward: ward.trim() } : {}),
      ...(bed.trim() ? { bed: bed.trim() } : {}),
      ...(dpjp.trim() ? { dpjp: dpjp.trim() } : {}),
      diagnoses: splitChips(diagnoses),
      labels: splitChips(labels),
    });

    void written.catch((error: unknown) => {
      console.error('[board] patient create rejected', error);
    });

    reset();
    onOpenChange(false);
    navigate(`/p/${id}`);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title="Pasien baru"
      description="Bisa dibuat tanpa koneksi — akan tersinkron otomatis."
      footer={
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim()}
          className="min-h-tap w-full rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          Simpan
        </button>
      }
    >
      <div className="space-y-3">
        <Field label="Nama *" value={name} onChange={setName} autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Field label="No. RM" value={mrn} onChange={setMrn} inputMode="numeric" />
          <Field label="Umur" value={age} onChange={setAge} inputMode="numeric" />
        </div>

        <div>
          <span className="mb-1 block text-xs text-fg-muted">Jenis kelamin</span>
          <div className="flex gap-2">
            {(['L', 'P'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSex(sex === value ? '' : value)}
                aria-pressed={sex === value}
                className={[
                  'min-h-tap flex-1 rounded-lg border px-3 text-sm',
                  sex === value ? 'border-accent font-medium text-accent' : 'border-border',
                ].join(' ')}
              >
                {value === 'L' ? 'Laki-laki' : 'Perempuan'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Ruang" value={ward} onChange={setWard} />
          <Field label="Bed" value={bed} onChange={setBed} />
        </div>

        <Field label="DPJP" value={dpjp} onChange={setDpjp} />
        <Field
          label="Diagnosis"
          value={diagnoses}
          onChange={setDiagnoses}
          hint="Pisahkan dengan koma"
        />
        <Field label="Label" value={labels} onChange={setLabels} hint="Pisahkan dengan koma" />
        <Field
          label="Tanggal masuk"
          type="date"
          value={admittedAt}
          onChange={(value) => setAdmittedAt(value as ClinicalDate)}
        />
      </div>
    </Sheet>
  );
}

function splitChips(value: string): string[] {
  return value
    .split(',')
    .map((chip) => chip.trim())
    .filter(Boolean);
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  hint,
  inputMode,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  hint?: string;
  inputMode?: 'text' | 'numeric';
  autoFocus?: boolean;
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-fg-muted">{label}</span>
      <input
        type={type}
        value={value}
        {...(inputMode ? { inputMode } : {})}
        {...(autoFocus ? { autoFocus: true } : {})}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-tap w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none"
      />
      {hint ? <span className="mt-1 block text-[11px] text-fg-faint">{hint}</span> : null}
    </label>
  );
}
