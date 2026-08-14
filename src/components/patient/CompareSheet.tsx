import { useEffect, useMemo, useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { fetchEntryBodies } from '@/data/repositories/entries.repo';
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
  const [days, setDays] = useState<Array<{ date: ClinicalDate; body: string }>>([]);
  const [against, setAgainst] = useState<ClinicalDate | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void fetchEntryBodies(patientId)
      .then((entries) => {
        if (cancelled) return;
        const earlier = entries
          .filter((entry) => entry.date < today && entry.body.trim().length > 0)
          .sort((a, b) => (a.date < b.date ? 1 : -1));
        setDays(earlier);
        // Default to the most recent earlier day, which is the comparison
        // actually wanted — not strictly yesterday, which may be empty.
        setAgainst(earlier[0]?.date ?? null);
      })
      .catch((error: unknown) => console.error('[compare] could not read entries', error));

    return () => {
      cancelled = true;
    };
  }, [open, patientId, today]);

  const other = days.find((day) => day.date === against);

  const segments = useMemo(
    () => (showDiff && other ? diffSegments(other.body, todayBody) : null),
    [showDiff, other, todayBody],
  );

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Bandingkan hari"
      description="Hanya untuk dibaca. Perubahan tetap dilakukan di catatan hari itu."
    >
      {days.length === 0 ? (
        <p className="text-sm text-fg-muted">Belum ada hari sebelumnya untuk dibandingkan.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-fg-muted">Bandingkan dengan</span>
            {days.slice(0, 6).map((day) => (
              <button
                key={day.date}
                type="button"
                aria-pressed={against === day.date}
                onClick={() => setAgainst(day.date)}
                className={[
                  'min-h-tap rounded-full border px-3 text-xs',
                  against === day.date
                    ? 'border-accent bg-bg-subtle font-medium text-accent'
                    : 'border-border text-fg-muted',
                ].join(' ')}
              >
                {formatShortDate(day.date)}
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
              <Pane label={other ? formatShortDate(other.date) : '—'} body={other?.body ?? ''} />
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
