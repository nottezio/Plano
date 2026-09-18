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
 * So each section is a card with its own edge, and each starts SMALL rather
 * than shut: the header carries the count, and under it a condensed view of
 * the content itself — the note's first lines, the checklist as ticks, the
 * next dates. Closed is still readable; opening it makes it editable and
 * complete.
 *
 * A header-only accordion was the first attempt and it was the wrong one.
 * "Minimised" has to mean less of the thing, not none of it: a sidebar of four
 * closed bars answers nothing without four taps, which is slower than the flat
 * list it replaced.
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
  preview,
  children,
}: {
  title: string;
  /** What the header says when closed — the answer, not a label. */
  summary?: string;
  /** `done` tints the summary: a finished checklist reads at a glance. */
  tone?: 'plain' | 'done';
  defaultOpen?: boolean;
  /**
   * The condensed view, shown while closed. Readable, not interactive: a
   * control that works in a preview and a different one that works when open
   * is two places to fix a behaviour.
   */
  preview?: ReactNode;
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
      {open ? (
        <div className="border-t border-border px-3 py-2">{children}</div>
      ) : preview ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Buka ${title}`}
          className="w-full cursor-pointer border-t border-border px-3 py-2 text-left"
        >
          {preview}
        </button>
      ) : null}
    </section>
  );
}
