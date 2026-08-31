import { useEffect, useMemo, useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import {
  fetchComparableEntries,
  type ComparableEntry,
} from '@/data/repositories/entries.repo';
import { formatShortDate } from '@/domain/clinicalDate';
import { diffSegments } from '@/domain/merge/threeWayMerge';
import type { ClinicalDate } from '@/domain/types';

/**
 * Today beside an earlier day.
 *
 * The question this answers is "what changed" — whether the plan moved, whether
 * a lab is new, whether something was dropped by accident when yesterday was
 * carried forward. Reading two days by flipping the date rail makes you hold
 * one in your head; side by side you do not have to.
 *
 * Read-only, deliberately. An editable second pane means two editors on one
 * patient in one tab, each with its own draft and merge state — and the first
 * time they disagree the user has no way to tell which one they are looking at.
 */
export function CompareSheet({
  open,
  onOpenChange,
  patientId,
  today,
  todayBody,
  currentLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  today: ClinicalDate;
  /** The note open in the editor — a day's SOAP, or a jaga note. */
  todayBody: string;
  /** What that note is, e.g. `Hari ini` or `Jaga 23.42 · Sen, 31 Agt`. */
  currentLabel: string;
}): JSX.Element {
  const [days, setDays] = useState<ComparableEntry[]>([]);
  const [against, setAgainst] = useState<string | null>(null);
  /**
   * The RIGHT pane, which used to be hard-wired to the note in the editor.
   *
   * That was the source of the confusion: with a jaga note open, the right
   * pane silently still held the day's SOAP, so "compare this jaga note with
   * that day's SOAP" produced two panes neither of which was the thing on
   * screen, and the header said "hari ini" over a note from another day.
   *
   * Both sides are now chosen the same way, from the same list, and the note
   * in the editor is simply one more entry in it — `null` means that entry.
   */
  const [right, setRight] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void fetchComparableEntries(patientId)
      .then((entries) => {
        if (cancelled) return;
        /**
         * A jaga note written TODAY is a valid comparison; the day's own SOAP
         * is not, because it is already the other pane.
         *
         * The old filter was `entry.date < today`, which was right when a date
         * was the only thing that could be compared. Keeping it would have
         * hidden exactly the note this change exists to show — the one written
         * at 23.42 last night, against the morning note it followed.
         */
        const earlier = entries.filter(
          (entry) => entry.date < today || entry.kind === 'jaga',
        );
        setDays(earlier);
        // Default to the most recent, which is the comparison actually wanted
        // — not strictly yesterday, which may be empty.
        setAgainst(earlier[0]?.key ?? null);
        // The right pane defaults to the note in the editor, which is what
        // someone comparing has open in front of them.
        setRight(null);
      })
      .catch((error: unknown) => console.error('[compare] could not read entries', error));

    return () => {
      cancelled = true;
    };
  }, [open, patientId, today]);

  /**
   * `null` means the note currently open in the editor.
   *
   * Kept as a sentinel rather than pushed into `days` as a synthetic entry,
   * because the editor's text is LIVE — it changes as you type, and a copy
   * captured into the list when the sheet opened would go stale mid-comparison
   * while looking authoritative.
   */
  const resolve = (key: string | null): { label: string; body: string } | null => {
    if (key === null) return { label: currentLabel, body: todayBody };
    const found = days.find((day) => day.key === key);
    return found ? { label: labelFor(found), body: found.body } : null;
  };

  /**
   * A jaga note is labelled by its TIME and marked as jaga; a day by its date.
   *
   * Same list, different shape — which is the point. It is not a child of the
   * day above it, it is another piece of writing from the same patient, and
   * the label only has to say which one you are looking at.
   */
  const labelFor = (entry: ComparableEntry): string =>
    entry.kind === 'jaga'
      ? `Jaga ${entry.time} · ${formatShortDate(entry.date)}`
      : formatShortDate(entry.date);

  const leftPane = resolve(against);
  const rightPane = resolve(right);

  const segments = useMemo(
    () =>
      showDiff && leftPane && rightPane ? diffSegments(leftPane.body, rightPane.body) : null,
    [showDiff, leftPane?.body, rightPane?.body],
  );

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Bandingkan catatan"
      description="Hanya untuk dibaca. Perubahan tetap dilakukan di catatan hari itu."
    >
      {days.length === 0 ? (
        <p className="text-sm text-fg-muted">
          Belum ada catatan lain untuk dibandingkan.
        </p>
      ) : (
        <>
          {/*
            One picker per pane, both drawing on the same list.

            The right pane used to be fixed to the note in the editor and
            labelled "hari ini". With a jaga note open that was wrong twice
            over: the pane held the day's SOAP rather than the note on screen,
            and the label claimed a date that might not be today's. Choosing
            both sides the same way removes the special case rather than
            renaming it.
          */}
          <PanePicker
            legend="Bandingkan"
            days={days}
            selected={against}
            currentLabel={currentLabel}
            labelFor={labelFor}
            onSelect={setAgainst}
          />
          <PanePicker
            legend="dengan"
            days={days}
            selected={right}
            currentLabel={currentLabel}
            labelFor={labelFor}
            onSelect={setRight}
          />

          <div className="mb-3">
            <button
              type="button"
              onClick={() => setShowDiff((current) => !current)}
              className="min-h-tap text-xs text-accent underline"
            >
              {showDiff ? 'Tampilkan berdampingan' : 'Tandai perubahan'}
            </button>
          </div>

          {showDiff && segments ? (
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-bg-subtle p-3 text-xs leading-relaxed">
              {segments.map((segment, index) => (
                <span
                  key={index}
                  className={
                    segment.type === 'insert'
                      ? 'bg-[var(--card-step-12-bg)] text-[var(--card-step-12-fg)]'
                      : segment.type === 'delete'
                        ? 'bg-[var(--card-step-1-bg)] text-[var(--card-step-1-fg)] line-through'
                        : undefined
                  }
                >
                  {segment.text}
                </span>
              ))}
            </pre>
          ) : (
            // Two columns from tablet up, stacked below — on a phone there is
            // no width for two readable columns, and a 40-character column is
            // worse than scrolling.
            <div className="grid gap-3 sm:grid-cols-2">
              <Pane label={leftPane?.label ?? '—'} body={leftPane?.body ?? ''} />
              <Pane label={rightPane?.label ?? '—'} body={rightPane?.body ?? ''} />
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}

function Pane({ label, body }: { label: string; body: string }): JSX.Element {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-semibold text-fg-muted">{label}</p>
      <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-bg-subtle p-3 text-xs leading-relaxed">
        {body.trim() || '(kosong)'}
      </pre>
    </div>
  );
}

/**
 * One row of chips for one pane.
 *
 * The note in the editor is the first option and is always present, because it
 * is the only one guaranteed to exist and the one most comparisons involve.
 */
function PanePicker({
  legend,
  days,
  selected,
  currentLabel,
  labelFor,
  onSelect,
}: {
  legend: string;
  days: readonly ComparableEntry[];
  selected: string | null;
  currentLabel: string;
  labelFor: (entry: ComparableEntry) => string;
  onSelect: (key: string | null) => void;
}): JSX.Element {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-fg-muted">{legend}</span>
      <Chip active={selected === null} onClick={() => onSelect(null)}>
        {currentLabel}
      </Chip>
      {days.slice(0, 8).map((day) => (
        <Chip
          key={day.key}
          active={selected === day.key}
          dashed={day.kind === 'jaga'}
          onClick={() => onSelect(day.key)}
        >
          {labelFor(day)}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  dashed,
  onClick,
  children,
}: {
  active: boolean;
  dashed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        'min-h-tap rounded-full border px-3 text-xs',
        // Dashed marks a jaga note. Not a second colour: solid-versus-accent
        // already means selected, and two colour axes on one control collide.
        dashed ? 'border-dashed' : '',
        active
          ? 'border-accent bg-bg-subtle font-medium text-accent'
          : 'border-border text-fg-muted',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
