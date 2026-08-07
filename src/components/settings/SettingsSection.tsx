import { useState, type ReactNode } from 'react';

/**
 * Collapsible by default.
 *
 * Settings had grown to nine always-open panels, several of them long editors,
 * and finding the one toggle you came for meant scrolling past four screens of
 * things you were not looking for. Collapsed sections turn that into a list of
 * headings you can scan.
 *
 * `defaultOpen` is for the two or three people actually change often; everything
 * else opens on demand.
 */
export function SettingsSection({
  title,
  description,
  children,
  collapsible = true,
  defaultOpen = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}): JSX.Element {
  const [open, setOpen] = useState(defaultOpen || !collapsible);

  if (!collapsible) {
    return (
      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-xs text-fg-muted">{description}</p> : null}
        <div className="mt-3">{children}</div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface">
      <h2>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          className="flex min-h-tap w-full items-center gap-3 p-4 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{title}</span>
            {description ? (
              <span className="mt-0.5 block text-xs text-fg-muted">{description}</span>
            ) : null}
          </span>
          <span aria-hidden="true" className="shrink-0 text-fg-faint">
            {open ? '−' : '+'}
          </span>
        </button>
      </h2>
      {open ? <div className="px-4 pb-4">{children}</div> : null}
    </section>
  );
}

/** A plain heading above a run of related sections. */
export function SettingsGroup({ label }: { label: string }): JSX.Element {
  return (
    <h2 className="px-1 pt-3 text-xs font-semibold uppercase tracking-wide text-fg-faint">
      {label}
    </h2>
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
