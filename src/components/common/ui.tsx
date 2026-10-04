import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { IconCheck, IconChevronRight } from './Icons';

/**
 * The sheet controls, in one place.
 *
 * WHY (2026-10-04 sheet revamp). Every sheet had grown its own controls:
 * 44 px rounded pills for choices, each menu entry its own bordered card,
 * grey 12 px text for section titles, underlined links for primary actions,
 * a different "selected" style per file. Each was reasonable alone. Side by
 * side they read as a prototype, which is what Avi called them: built
 * partially and never finished.
 *
 * One vocabulary, used everywhere:
 *  - Section      a labelled block; the label is small caps, so it reads as
 *                 structure rather than as content.
 *  - Segmented    2–4 mutually exclusive options (format, view, sapaan).
 *  - ChoiceChip   more options than fit a segment, or multi-select (Bentuk,
 *                 Bagian, archive reason).
 *  - ListGroup / ListRow
 *                 actions and single-choice lists: one container, divided
 *                 rows, icon on the left, chevron or check on the right.
 *  - Callout      anything the user should read before acting, by tone.
 *  - Button       primary / secondary / ghost / danger, two sizes.
 *  - Field        a labelled input with an optional hint.
 *
 * TAP TARGETS. Touch keeps the 44 px floor (`min-h-tap`). A fine pointer gets
 * 36 px, which is what makes a laptop sheet stop looking like a phone screen
 * blown up. The check:a11y script only rejects explicit sub-44 px heights, and
 * none are written here.
 */

const FINE = '[@media(pointer:fine)]:min-h-9';

export function Section({
  title,
  hint,
  aside,
  children,
  className = '',
}: {
  title?: string;
  /** Small print under the content: what it does, not how to use it. */
  hint?: ReactNode;
  /** Something on the title row's right: a count, a small action. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <section className={`space-y-2 ${className}`}>
      {title || aside ? (
        <div className="flex min-h-5 items-center gap-2">
          {title ? (
            <h3 className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-fg-faint">
              {title}
            </h3>
          ) : (
            <span className="flex-1" />
          )}
          {aside}
        </div>
      ) : null}
      {children}
      {hint ? <p className="text-[11px] leading-relaxed text-fg-faint">{hint}</p> : null}
    </section>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  size = 'md',
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<readonly [T, ReactNode]>;
  size?: 'sm' | 'md';
}): JSX.Element {
  return (
    <div
      role="group"
      aria-label={label}
      className={[
        'flex rounded-xl border border-border bg-bg-subtle p-0.5',
        size === 'sm' ? 'inline-flex' : 'w-full',
      ].join(' ')}
    >
      {options.map(([key, text]) => {
        const on = value === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(key)}
            className={[
              `min-h-tap ${FINE} rounded-lg px-3 text-xs transition-colors`,
              size === 'sm' ? '' : 'flex-1',
              on
                ? 'bg-surface font-semibold text-fg shadow-sm ring-1 ring-border'
                : 'text-fg-muted hover:text-fg',
            ].join(' ')}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

export function ChoiceChip({
  active,
  onClick,
  disabled = false,
  dashed = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  /** A secondary kind of option (a version, a jaga note). */
  dashed?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={[
        `inline-flex min-h-tap ${FINE} items-center gap-1.5 rounded-lg border px-3 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-35`,
        dashed ? 'border-dashed' : '',
        active
          ? 'border-accent bg-[var(--accent-soft)] font-semibold text-accent'
          : 'border-border bg-surface text-fg hover:border-border-strong hover:bg-bg-subtle',
      ].join(' ')}
    >
      {active ? <IconCheck width={14} height={14} strokeWidth={2.5} /> : null}
      {children}
    </button>
  );
}

export function ChipRow({ children }: { children: ReactNode }): JSX.Element {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

export function ListGroup({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {children}
    </div>
  );
}

/**
 * One row of a ListGroup.
 *
 * `selected` turns it into a radio row (check on the right, accent text);
 * otherwise it is an action row with a chevron. `trailing` replaces either.
 */
export function ListRow({
  icon,
  title,
  detail,
  onClick,
  selected,
  trailing,
  tone = 'default',
  disabled = false,
  badge,
}: {
  icon?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  onClick: () => void;
  selected?: boolean;
  trailing?: ReactNode;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  /** A short state word beside the title: `Aktif`, `sesuai jam`. */
  badge?: ReactNode;
}): JSX.Element {
  const radio = selected !== undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...(radio ? { 'aria-pressed': selected } : {})}
      className={[
        'flex min-h-tap w-full items-center gap-3 px-3 py-2.5 text-left transition-colors disabled:opacity-40',
        'hover:bg-bg-subtle focus-visible:bg-bg-subtle focus-visible:outline-none',
        selected ? 'bg-[var(--accent-soft)]' : '',
      ].join(' ')}
    >
      {icon ? (
        <span
          className={[
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            tone === 'danger'
              ? 'bg-[var(--danger-soft)] text-danger'
              : 'bg-bg-subtle text-fg-muted',
          ].join(' ')}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span
          className={[
            'flex flex-wrap items-center gap-x-2 text-sm',
            tone === 'danger' ? 'font-medium text-danger' : selected ? 'font-semibold text-accent' : 'font-medium text-fg',
          ].join(' ')}
        >
          <span className="min-w-0">{title}</span>
          {badge ? (
            <span className="rounded-md bg-bg-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
              {badge}
            </span>
          ) : null}
        </span>
        {detail ? (
          <span className="mt-0.5 block text-xs leading-snug text-fg-muted">{detail}</span>
        ) : null}
      </span>
      {trailing ??
        (radio ? (
          selected ? (
            <IconCheck width={18} height={18} strokeWidth={2.5} className="shrink-0 text-accent" />
          ) : (
            <span className="h-[18px] w-[18px] shrink-0" />
          )
        ) : (
          <IconChevronRight width={16} height={16} className="shrink-0 text-fg-faint" />
        ))}
    </button>
  );
}

const CALLOUT_TONE = {
  info: 'border-border bg-bg-subtle text-fg',
  accent: 'border-accent bg-[var(--accent-soft)] text-fg',
  warn: 'border-[var(--warn-strong)] bg-[var(--warn-soft)] text-fg',
  danger: 'border-danger bg-[var(--danger-soft)] text-fg',
} as const;

export function Callout({
  tone = 'info',
  title,
  children,
  action,
  role,
}: {
  tone?: keyof typeof CALLOUT_TONE;
  title?: ReactNode;
  children?: ReactNode;
  /** A button on the right (wraps under the text on a phone). */
  action?: ReactNode;
  role?: 'alert' | 'status';
}): JSX.Element {
  return (
    <div
      {...(role ? { role } : {})}
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2.5 ${CALLOUT_TONE[tone]}`}
    >
      <div className="min-w-0 flex-1 text-xs leading-relaxed">
        {title ? (
          <p className={`font-semibold ${tone === 'danger' ? 'text-danger' : ''}`}>{title}</p>
        ) : null}
        {children ? <div className={title ? 'mt-0.5 text-fg-muted' : ''}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

const BUTTON_VARIANT = {
  primary: 'bg-accent text-white hover:opacity-90 disabled:opacity-40',
  secondary:
    'border border-border bg-surface text-fg hover:bg-bg-subtle disabled:opacity-40',
  ghost: 'text-accent hover:bg-[var(--accent-soft)] disabled:opacity-40',
  danger: 'border border-danger text-danger hover:bg-[var(--danger-soft)] disabled:opacity-40',
} as const;

export function Button({
  variant = 'secondary',
  size = 'md',
  full = false,
  icon,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANT;
  size?: 'sm' | 'md';
  full?: boolean;
  icon?: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      {...rest}
      className={[
        'inline-flex min-h-tap items-center justify-center gap-1.5 rounded-xl font-medium transition-colors disabled:cursor-not-allowed',
        size === 'sm' ? `${FINE} px-3 text-xs` : 'px-4 text-sm',
        full ? 'w-full' : '',
        BUTTON_VARIANT[variant],
        className,
      ].join(' ')}
    >
      {icon}
      {children}
    </button>
  );
}

/** Shared input look, for the inputs that are not wrapped in `Field`. */
export const INPUT =
  'min-h-tap w-full rounded-xl border border-border bg-surface px-3 text-sm text-fg outline-none transition-colors placeholder:text-fg-faint focus:border-accent [@media(pointer:fine)]:min-h-10';

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className = '',
}: {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-fg-muted">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[11px] leading-relaxed text-fg-faint">{hint}</p> : null}
    </div>
  );
}

/** A checkbox as a full-width row: the whole row is the target. */
export function CheckRow({
  checked,
  onChange,
  title,
  detail,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: ReactNode;
  detail?: ReactNode;
}): JSX.Element {
  return (
    <label className="flex min-h-tap cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 hover:bg-bg-subtle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-fg">{title}</span>
        {detail ? <span className="mt-0.5 block text-xs leading-snug text-fg-muted">{detail}</span> : null}
      </span>
    </label>
  );
}

/** A read-only block of note text: previews, before/after panes. */
export function TextPane({
  label,
  children,
  maxHeight = 'max-h-[50vh]',
}: {
  label?: ReactNode;
  children: ReactNode;
  maxHeight?: string;
}): JSX.Element {
  return (
    <div className="min-w-0">
      {label ? <p className="mb-1 truncate text-xs font-medium text-fg-muted">{label}</p> : null}
      <pre
        className={`${maxHeight} overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-bg-subtle p-3 font-mono text-xs leading-relaxed text-fg`}
      >
        {children}
      </pre>
    </div>
  );
}
