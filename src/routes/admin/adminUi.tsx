import { useEffect, useState } from 'react';

/** Small pieces shared by the admin tabs. */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** "5 mnt lalu", "3 jam lalu", "kemarin", "12 hari lalu", or the date. */
export function ago(date: Date | null, now: number): string {
  if (!date) return 'belum pernah';
  const diff = now - date.getTime();
  if (diff < 60_000) return 'baru saja';
  if (diff < 3_600_000) return `${String(Math.floor(diff / 60_000))} mnt lalu`;
  if (diff < DAY_MS) return `${String(Math.floor(diff / 3_600_000))} jam lalu`;
  if (diff < 2 * DAY_MS) return 'kemarin';
  if (diff < 60 * DAY_MS) return `${String(Math.floor(diff / DAY_MS))} hari lalu`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const when = (date: Date | null): string =>
  date
    ? date.toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

export function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone?: 'warn' | undefined;
}): JSX.Element {
  return (
    <div
      className={[
        'rounded-xl border p-3',
        tone === 'warn' ? 'border-[var(--warn-strong)] bg-[var(--warn-soft)]' : 'border-border bg-surface',
      ].join(' ')}
    >
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums">{value ?? '—'}</p>
    </div>
  );
}

export function Field({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="min-w-0">
      <dt className="text-fg-faint">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}

/** First tap arms, second acts; disarms after five seconds. */
export function ArmedButton({
  label,
  armedLabel,
  danger = false,
  onConfirm,
}: {
  label: string;
  armedLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}): JSX.Element {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const timer = window.setTimeout(() => setArmed(false), 5000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
      className={[
        'min-h-tap rounded-lg border px-3 text-xs font-medium [@media(pointer:fine)]:min-h-8',
        armed || danger ? 'border-danger text-danger' : 'border-border',
      ].join(' ')}
    >
      {armed ? armedLabel : label}
    </button>
  );
}
