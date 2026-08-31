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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  today: ClinicalDate;
  todayBody: string;
}): JSX.Element {
  const [days, setDays] = useState<ComparableEntry[]>([]);
  const [against, setAgainst] = useState<string | null>(null);
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
      })
      .catch((error: unknown) => console.error('[compare] could not read entries', error));

    return () => {
      cancelled = true;
    };
  }, [open, patientId, today]);

  const other = days.find((day) => day.key === against);

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

  const segments = useMemo(
    () => (showDiff && other ? diffSegments(other.body, todayBody) : null),
    [showDiff, other, todayBody],
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
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-fg-muted">Bandingkan dengan</span>
            {days.slice(0, 8).map((day) => (
              <button
                key={day.key}
                type="button"
                aria-pressed={against === day.key}
                onClick={() => setAgainst(day.key)}
                className={[
                  'min-h-tap rounded-full border px-3 text-xs',
                  // A jaga chip is dashed rather than a different colour: the
                  // solid/accent pair already means selected, and a second
                  // colour axis on the same control would collide with it.
                  day.kind === 'jaga' ? 'border-dashed' : '',
                  against === day.key
                    ? 'border-accent bg-bg-subtle font-medium text-accent'
                    : 'border-border text-fg-muted',
                ].join(' ')}
              >
                {labelFor(day)}
              </button>
            ))}
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
              <Pane label={other ? labelFor(other) : '—'} body={other?.body ?? ''} />
              <Pane label={`${formatShortDate(today)} (hari ini)`} body={todayBody} />
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
