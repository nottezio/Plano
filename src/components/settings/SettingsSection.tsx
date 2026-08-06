import type { ReactNode } from 'react';

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {description ? <p className="mt-1 text-xs text-fg-muted">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 py-2 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-fg-muted">{description}</span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className={[
          'mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors',
          checked ? 'bg-accent' : 'bg-border-strong',
        ].join(' ')}
      >
        <span
          className={[
            'h-5 w-5 rounded-full bg-white transition-transform',
            checked ? 'translate-x-4' : '',
          ].join(' ')}
        />
      </span>
    </button>
  );
}
