import { useEffect, useRef, useState } from 'react';

import { Button } from './ui';

/** How long the question waits before it puts the button back (nobody walks into it later). */
const ASK_MS = 6000;

/**
 * A destructive action behind a second tap, in the button itself (26 Oct 2026,
 * Avi: removing a member was one tap on a phone).
 *
 * The first tap only asks; the question names what will happen, so the wrong
 * row cannot be confirmed by habit. It puts itself back after a few seconds and
 * on Batal. A failed action reports through `onError` and stays open to retry.
 */
export function TwoTapButton({
  label,
  ariaLabel,
  question,
  confirmLabel = 'Ya',
  busyLabel = 'Memproses…',
  onConfirm,
  onError,
}: {
  label: string;
  ariaLabel?: string;
  /** Asked after the first tap, naming the person or thing affected. */
  question: string;
  confirmLabel?: string;
  busyLabel?: string;
  onConfirm: () => Promise<unknown>;
  /** Called with the rejection; the caller words it (`saveErrorMessage`). */
  onError?: (error: unknown) => void;
}): JSX.Element {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!asking || busy) return undefined;
    confirmRef.current?.focus();
    const timer = window.setTimeout(() => setAsking(false), ASK_MS);
    return () => window.clearTimeout(timer);
  }, [asking, busy]);

  if (!asking) {
    return (
      <Button size="sm" variant="danger" aria-label={ariaLabel ?? label} onClick={() => setAsking(true)}>
        {label}
      </Button>
    );
  }
  return (
    <span role="group" aria-label={question} className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium">{question}</span>
      <button
        ref={confirmRef}
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          onConfirm()
            .then(() => setAsking(false))
            .catch((error: unknown) => onError?.(error))
            .finally(() => setBusy(false));
        }}
        className="min-h-tap rounded-lg bg-danger px-3 text-xs font-semibold text-white disabled:opacity-60 [@media(pointer:fine)]:min-h-9"
      >
        {busy ? busyLabel : confirmLabel}
      </button>
      <Button size="sm" onClick={() => setAsking(false)} disabled={busy}>
        Batal
      </Button>
    </span>
  );
}
