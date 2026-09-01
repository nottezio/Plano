import { useEffect, useMemo, useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import {
  fetchComparableEntries,
  type ComparableEntry,
} from '@/data/repositories/entries.repo';
import { formatShortDate } from '@/domain/clinicalDate';
import { diffSegmentsByLine } from '@/domain/merge/threeWayMerge';

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
  todayBody,
  currentLabel,
  currentKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  /** The note open in the editor — a day's SOAP, or a jaga note. */
  todayBody: string;
  /** What that note is, e.g. `Hari ini` or `Jaga 23.42 · Sen, 31 Agt`. */
  currentLabel: string;
  /**
   * The key of the open note in the comparable list, so it is not offered
   * twice — once as "dibuka" and once under its own date.
   */
  currentKey: string;
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
         * Everything except the note already open, which is the first chip.
         *
         * Two filters have been wrong here in turn. `entry.date < today` was
         * right only while a date was the sole thing comparable. Replacing it
         * with `date < today || kind === 'jaga'` then hid the DAY'S OWN SOAP —
         * so with a jaga note open there was no way to compare it against the
         * morning note it followed, which is the single most useful comparison
         * a shift note has.
         *
         * Both were versions of the same mistake: deciding what could not be
         * compared from what USED to occupy the other pane, back when that
         * pane was fixed. Now that both sides are chosen, the only entry that
         * cannot be picked is the one already offered as "dibuka" — and
         * excluding it by key rather than by date or kind cannot go stale the
         * next time something new becomes comparable.
         */
        const earlier = entries.filter((entry) => entry.key !== currentKey);
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
  }, [open, patientId, currentKey]);

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
      showDiff && leftPane && rightPane ? diffSegmentsByLine(leftPane.body, rightPane.body) : null,
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
            <>
              {/*
                Say which way round the comparison runs, in words, above the
                colours.

                A red/green diff with no stated direction is ambiguous by
                construction: red can mean "deleted from the left" or "missing
                on the right" depending on which side you think is the
                baseline, and the reader has no way to tell which. Naming the
                two notes and the direction between them makes the colours
                readable without having to reason about them.
              */}
              <p className="mb-1 text-xs text-fg-muted">
                Perubahan dari <strong className="text-fg">{leftPane?.label}</strong> ke{' '}
                <strong className="text-fg">{rightPane?.label}</strong>
              </p>

              <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] text-fg-muted">
                <span className="flex items-center gap-1">
                  <span className="rounded bg-[var(--card-step-12-bg)] px-1 text-[var(--card-step-12-fg)]">
                    hijau
                  </span>
                  baru di {rightPane?.label}
                </span>
                <span className="flex items-center gap-1">
                  <span className="rounded bg-[var(--card-step-1-bg)] px-1 text-[var(--card-step-1-fg)] line-through">
                    merah
                  </span>
                  hilang dari {leftPane?.label}
                </span>
              </div>

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
            </>
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
