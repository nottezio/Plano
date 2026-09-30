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
 * Search, shared by every section on the page.
 *
 * The page is ~25 sections in six groups. Finding "PIN" or "watermark" by
 * opening groups one by one is the problem the revamp is for; typing it is
 * faster, and a matching section opens itself.
 */
const SearchContext = createContext<readonly string[]>([]);

export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
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

export function SettingsSearchProvider({
  query,
  children,
}: {
  query: string;
  children: ReactNode;
}): JSX.Element {
  const tokens = useMemo(() => searchTokens(query), [query]);
  return <SearchContext.Provider value={tokens}>{children}</SearchContext.Provider>;
}

const OPEN_EVENT = 'plano:settings-open';

/** Open a section by id and scroll to it (e.g. "Lihat yang baru"). */
export function openSettingsSection(id: string): void {
  window.dispatchEvent(new CustomEvent<string>(OPEN_EVENT, { detail: id }));
}

/**
 * Collapsible by default.
 *
 * Settings had grown to nine always-open panels, several of them long editors,
 * and finding the one toggle you came for meant scrolling past four screens of
 * things you were not looking for. Collapsed sections turn that into a list of
 * headings you can scan.
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
  children,
  collapsible = true,
  defaultOpen = false,
}: {
  id?: string;
  title: string;
  description?: string | undefined;
  keywords?: string;
  badge?: string | undefined;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}): JSX.Element {
  const [open, setOpen] = useState(defaultOpen || !collapsible);
  const tokens = useContext(SearchContext);
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

  return (
    <section
      ref={ref}
      id={id}
      hidden={!matches}
      className="scroll-mt-32 rounded-xl border border-border bg-surface"
    >
      <h3>
        {collapsible && !searching ? (
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-controls={bodyId}
            className="flex min-h-tap w-full items-center gap-3 rounded-xl p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <SectionHeading title={title} description={description} badge={badge} />
            <span
              aria-hidden="true"
              className={[
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-fg-muted transition-transform',
                open ? 'rotate-180' : '',
              ].join(' ')}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-3 p-4 pb-0">
            <SectionHeading title={title} description={description} badge={badge} />
          </div>
        )}
      </h3>
      {shown ? (
        <div id={bodyId} className={collapsible && !searching ? 'px-4 pb-4' : 'p-4'}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

function SectionHeading({
  title,
  description,
  badge,
}: {
  title: string;
  description?: string | undefined;
  badge?: string | undefined;
}): JSX.Element {
  return (
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-2 text-[15px] font-semibold">
        {title}
        {badge ? (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            {badge}
          </span>
        ) : null}
      </span>
      {description ? (
        <span className="mt-0.5 block text-xs leading-relaxed text-fg-muted">{description}</span>
      ) : null}
    </span>
  );
}

/**
 * A titled run of related sections, and the target of the jump bar.
 *
 * `settings-group` hides itself (index.css, `:has`) when a search leaves none
 * of its sections visible, so the results are not interleaved with empty
 * headings.
 */
export function SettingsGroup({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}): JSX.Element {
  const headingId = `${id}-heading`;
  return (
    <div id={id} role="group" aria-labelledby={headingId} className="settings-group scroll-mt-32 space-y-2">
      <h2
        id={headingId}
        className="px-1 pt-4 text-xs font-semibold uppercase tracking-wide text-fg-muted"
      >
        {label}
      </h2>
      {children}
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
