import { useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '@/lib/pinCrypto';
import { useLock } from '@/store/useLock';

/** SPEC 18 — set or replace the device PIN. */
export function PinSetupSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  const createPin = useLock((state) => state.createPin);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const mismatch = confirm.length > 0 && pin !== confirm;
  const valid = pin.length >= PIN_MIN_LENGTH && pin === confirm;

  const close = (): void => {
    setPin('');
    setConfirm('');
    onOpenChange(false);
  };

  const submit = (): void => {
    if (!valid || busy) return;
    setBusy(true);
    void createPin(pin)
      .then(close)
      .finally(() => setBusy(false));
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title="Atur PIN"
      description={`${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} angka.`}
      footer={
        <button
          type="button"
          onClick={submit}
          disabled={!valid || busy}
          className="min-h-tap w-full rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          Simpan PIN
        </button>
      }
    >
      <div className="space-y-3">
        <PinField label="PIN baru" value={pin} onChange={setPin} />
        <PinField label="Ulangi PIN" value={confirm} onChange={setConfirm} />
        {mismatch ? (
          <p role="alert" className="text-xs text-danger">
            PIN tidak sama.
          </p>
        ) : null}
      </div>

      <p className="mt-4 rounded-lg border border-border bg-bg-subtle p-3 text-[11px] leading-relaxed text-fg-muted">
        PIN hanya menutup layar di perangkat ini. Catatan tetap tersimpan tanpa enkripsi di
        penyimpanan peramban, sehingga PIN bukan pengganti kunci layar perangkat. Tidak ada
        pemulihan PIN — bila lupa, keluar lalu masuk kembali.
      </p>
    </Sheet>
  );
}

function PinField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-fg-muted">{label}</span>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        maxLength={PIN_MAX_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
        className="min-h-tap w-full rounded-lg border border-border bg-surface px-3 text-center text-lg tracking-[0.4em] outline-none"
      />
    </label>
  );
}
