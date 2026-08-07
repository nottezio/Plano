import { useEffect, useRef, useState } from 'react';

import { Footer } from '@/components/common/Footer';
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '@/lib/pinCrypto';
import { signOutAndClear } from '@/store/useSession';
import { useLock } from '@/store/useLock';

/**
 * SPEC 18 — the lock screen.
 *
 * There is no "forgot PIN" recovery, because there is nothing to recover: the
 * PIN never leaves the device and unlocks nothing on the server. The only way
 * past it is signing out, which clears the local cache and re-syncs — no note
 * is lost, and the escape is stated on screen rather than hidden.
 */
export function LockScreen(): JSX.Element {
  const unlock = useLock((state) => state.unlock);
  const failures = useLock((state) => state.failures);
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (): void => {
    if (pin.length < PIN_MIN_LENGTH || checking) return;
    setChecking(true);
    void unlock(pin)
      .then((ok) => {
        if (!ok) setPin('');
      })
      .finally(() => setChecking(false));
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-bg">
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <h1 className="text-lg font-semibold">Plano terkunci</h1>
        <p className="mt-1 text-center text-xs text-fg-muted">
          Masukkan PIN untuk melanjutkan.
        </p>

        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          maxLength={PIN_MAX_LENGTH}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
          }}
          aria-label="PIN"
          className="mt-6 w-40 rounded-lg border border-border bg-surface py-3 text-center text-2xl tracking-[0.5em] outline-none"
        />

        {failures > 0 ? (
          <p role="alert" className="mt-3 text-xs text-danger">
            PIN salah. Percobaan ke-{failures}.
          </p>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={pin.length < PIN_MIN_LENGTH || checking}
          className="mt-4 min-h-tap w-40 rounded-lg bg-accent text-sm font-medium text-white disabled:opacity-40"
        >
          {checking ? 'Memeriksa…' : 'Buka'}
        </button>

        <button
          type="button"
          onClick={() => void signOutAndClear()}
          className="mt-8 text-xs text-fg-faint underline"
        >
          Lupa PIN? Keluar dan masuk lagi
        </button>
        <p className="mt-2 max-w-xs text-center text-[11px] text-fg-faint">
          Keluar menghapus data offline di perangkat ini. Catatan tetap aman di server dan
          akan tersinkron ulang.
        </p>
      </div>
      <Footer />
    </div>
  );
}
