import { useState, type ReactNode } from 'react';

/**
 * One section of the patient sidebar in the panel layout.
 *
 * The sidebar used to be four blocks of text separated by nothing but a gap:
 * a heading in the same muted grey as the content under it, then the next.
 * With a long stay the date list alone ran past the fold, so the checklist —
 * the thing you tick while reading — was off screen, and the flat rhythm gave
 * no way to see at a glance which block was which.
 *
 * So each section is a card with its own edge, and each starts CLOSED with a
 * summary on the header: `7/7`, `0/1`, `12 hari`. Closed, the whole sidebar is
 * four rows and every answer is on those rows; open, one section at a time
 * takes the space it needs.
 *
 * Closed on mount, deliberately not remembered. A sidebar that reopens
 * whichever sections were open on the last patient puts different things in
 * front of you depending on where you have been, and the summaries mean a
 * closed section is not a hidden one.
 */
export function SidePanel({
  title,
  summary,
  tone = 'plain',
  defaultOpen = false,
  children,
}: {
  title: string;
  /** What the header says when closed — the answer, not a label. */
  summary?: string;
  /** `done` tints the summary: a finished checklist reads at a glance. */
  tone?: 'plain' | 'done';
  defaultOpen?: boolean;
  children: ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex min-h-tap w-full items-center gap-2 px-3 text-left"
      >
        <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          {title}
        </span>
        {summary ? (
          <span
            className={[
              'shrink-0 rounded px-1.5 py-0.5 text-[11px] tabular-nums',
              tone === 'done' ? 'bg-accent/15 text-accent' : 'bg-bg-subtle text-fg-muted',
            ].join(' ')}
          >
            {summary}
          </span>
        ) : null}
        <span aria-hidden="true" className="shrink-0 text-fg-faint">
          {open ? '−' : '+'}
        </span>
      </button>
      {open ? <div className="border-t border-border px-3 py-2">{children}</div> : null}
    </section>
  );
}
