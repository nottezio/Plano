import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * Search and the open category, shared by every section on the page.
 *
 * The page is ~30 sections in six categories. Finding "PIN" or "watermark" by
 * opening categories one by one is the problem the revamp is for; typing it is
 * faster, and a matching section opens itself.
 */
const SettingsContext = createContext<{ tokens: readonly string[]; active: string | null }>({
  tokens: [],
  active: null,
});

export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function searchTokens(query: string): string[] {
  return normalizeSearch(query).split(/\s+/).filter(Boolean);
}

/**
 * Every token starts a word of the text. Prefix, not substring: "pin" must
 * find PIN, not "samping" in a description.
 */
export function matchesSearch(text: string, tokens: readonly string[]): boolean {
  const words = normalizeSearch(text).split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.every((token) => words.some((word) => word.startsWith(token)));
}

/**
 * `active` is the open category. While a search is typed every category
 * renders, so its sections can match; otherwise only the open one does.
 */
export function SettingsSearchProvider({
  query,
  active,
  children,
}: {
  query: string;
  active: string;
  children: ReactNode;
}): JSX.Element {
  const tokens = useMemo(() => searchTokens(query), [query]);
  const value = useMemo(() => ({ tokens, active }), [tokens, active]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

const OPEN_EVENT = 'plano:settings-open';

/** Open a section by id and scroll to it (e.g. "Lihat yang baru"). It must be in the open category. */
export function openSettingsSection(id: string): void {
  window.dispatchEvent(new CustomEvent<string>(OPEN_EVENT, { detail: id }));
}

/**
 * One row of a settings list.
 *
 * Collapsed, a row is its title and its current value and nothing else, so a
 * category reads as a list you can scan and check without opening anything.
 * The explanation lives inside, above the controls it explains. Opening a row
 * is how you change it; there is no Save, every control writes immediately.
 *
 * While a search is typed, a section that does not match is `hidden` (so the
 * group CSS can hide a group left empty) and one that matches is open.
 * `keywords` are extra words to find it by, never shown.
 */
export function SettingsSection({
  id,
  title,
  description,
  keywords,
  badge,
  value,
  children,
  collapsible = true,
  defaultOpen = false,
}: {
  id?: string;
  title: string;
  description?: string | undefined;
  keywords?: string;
  badge?: string | undefined;
  /** The current choice, readable without opening the section. */
  value?: string | undefined;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}): JSX.Element {
  const [open, setOpen] = useState(defaultOpen || !collapsible);
  const { tokens } = useContext(SettingsContext);
  const ref = useRef<HTMLElement>(null);
  const bodyId = useId();

  useEffect(() => {
    if (!id) return undefined;
    const onOpen = (event: Event): void => {
      if ((event as CustomEvent<string>).detail !== id) return;
      setOpen(true);
      window.requestAnimationFrame(() =>
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [id]);

  const searching = tokens.length > 0;
  const matches = !searching || matchesSearch(`${title} ${description ?? ''} ${keywords ?? ''}`, tokens);
  const shown = open || searching || !collapsible;
  const heading = (
    <span className="flex min-w-0 flex-1 items-center gap-2 text-[15px] font-medium">
      <span className="min-w-0">{title}</span>
      {badge ? (
        <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-on-accent">
          {badge}
        </span>
      ) : null}
    </span>
  );

  return (
    <section ref={ref} id={id} hidden={!matches} className="scroll-mt-20">
      <h3>
        {collapsible && !searching ? (
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-controls={bodyId}
            className="flex min-h-[3.25rem] w-full items-center gap-3 px-4 py-2 text-left hover:bg-bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:[outline-offset:-2px] focus-visible:outline-accent"
          >
            {heading}
            {value ? <span className="max-w-[45%] shrink-0 truncate text-xs text-fg-muted">{value}</span> : null}
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={[
                'shrink-0 text-fg-faint transition-transform duration-150 motion-reduce:transition-none',
                open ? 'rotate-180' : '',
              ].join(' ')}
            >
              <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <div className="flex items-center gap-3 px-4 pt-4">{heading}</div>
        )}
      </h3>
      {shown ? (
        <div id={bodyId} className="px-4 pb-4 pt-1">
          {description ? (
            <p className="mb-3 max-w-prose text-xs leading-relaxed text-fg-muted">{description}</p>
          ) : null}
          {children}
        </div>
      ) : null}
    </section>
  );
}

/**
 * One category, and the target of nothing but the page's own navigation.
 *
 * It renders only while open (or while a search needs every section mounted),
 * so a phone never builds the editors of five categories it is not showing.
 * `settings-group` hides itself (index.css, `:has`) when a search leaves none
 * of its sections visible, so the results are not interleaved with empty
 * headings. Its heading is the page title for the open category, and a small
 * label over its matches in a search.
 */
export function SettingsGroup({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}): JSX.Element | null {
  const { tokens, active } = useContext(SettingsContext);
  const searching = tokens.length > 0;
  if (!searching && active !== id) return null;
  const headingId = `settings-${id}-heading`;
  return (
    <div
      id={`settings-${id}`}
      role="group"
      aria-labelledby={headingId}
      className="settings-group scroll-mt-20 space-y-4 pt-4"
    >
      <h2
        id={headingId}
        className={
          searching
            ? 'px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted'
            : 'px-1 text-lg font-semibold tracking-tight text-fg'
        }
      >
        {label}
      </h2>
      {children}
    </div>
  );
}

/**
 * Sections that change the same kind of thing: one list under an optional
 * small label. Hides itself like a group.
 */
export function SettingsSubgroup({ label, children }: { label?: string; children: ReactNode }): JSX.Element {
  const headingId = useId();
  return (
    <div
      role={label ? 'group' : undefined}
      aria-labelledby={label ? headingId : undefined}
      className="settings-group space-y-2"
    >
      {label ? (
        <p id={headingId} className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          {label}
        </p>
      ) : null}
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {children}
      </div>
    </div>
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
      className="flex min-h-tap w-full items-center gap-3 rounded-lg py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
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
          'flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors',
          checked ? 'bg-accent' : 'bg-border-strong',
        ].join(' ')}
      >
        <span
          className={[
            'h-6 w-6 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : '',
          ].join(' ')}
        />
      </span>
    </button>
  );
}
