import { useEffect, useMemo, useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import {
  fetchComparableEntries,
  type ComparableEntry,
} from '@/data/repositories/entries.repo';
import { formatShortDate } from '@/domain/clinicalDate';
import { diffSegmentsByLine } from '@/domain/merge/threeWayMerge';
import { diffRevision, type RevisionRow } from '@/domain/format/revisionDiff';

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
  onApplyRevision,
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
  /**
   * Replace the note on screen with a pasted revision.
   *
   * The ONE write this sheet can cause, and only from the revision mode, where
   * the user pasted the text themselves. Everything else here stays read-only:
   * the panes are notes from other days, and editing them from a comparison
   * view is how you end up editing the wrong day.
   *
   * Absent when the open note is a jaga note, which has its own editor.
   */
  onApplyRevision?: (body: string) => void;
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
  /**
   * Between two notes Plano holds, or between the open note and a revision
   * pasted in from outside.
   */
  const [mode, setMode] = useState<'antar' | 'revisi'>('antar');

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

  /**
   * The diff reads the two BODIES, taken out as strings first.
   *
   * `resolve` builds a fresh pane object every render, so depending on the
   * panes would re-diff on every keystroke anywhere on the page. Listing
   * `leftPane?.body` while reading `leftPane` inside was correct but left the
   * dependency list incomplete as written — the shape a later edit turns
   * into a stale diff. Strings make it complete and stable at once.
   */
  const leftBody = leftPane?.body;
  const rightBody = rightPane?.body;
  const segments = useMemo(
    () =>
      showDiff && leftBody !== undefined && rightBody !== undefined
        ? diffSegmentsByLine(leftBody, rightBody)
        : null,
    [showDiff, leftBody, rightBody],
  );

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Bandingkan catatan"
      description="Hanya untuk dibaca. Perubahan tetap dilakukan di catatan hari itu."
    >
      <div role="group" aria-label="Jenis perbandingan" className="mb-3 flex flex-wrap gap-2">
        <Chip active={mode === 'antar'} onClick={() => setMode('antar')}>
          Antar catatan
        </Chip>
        <Chip active={mode === 'revisi'} onClick={() => setMode('revisi')}>
          Dengan revisi tempelan
        </Chip>
      </div>

      {mode === 'revisi' ? (
        <RevisionCompare
          mine={todayBody}
          mineLabel={currentLabel}
          {...(onApplyRevision
            ? {
                onApply: (body: string) => {
                  onApplyRevision(body);
                  onOpenChange(false);
                },
              }
            : {})}
        />
      ) : days.length === 0 ? (
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

/**
 * The open note against a revised copy pasted in (usually the chief's).
 *
 * The pasted text lives in this component's state only. It is not saved,
 * not synced, and is gone when the sheet closes: it is someone else's version
 * of a clinical note, and the decision about what to take from it is made
 * in the editor, by hand.
 *
 * "Abaikan format" is on by default. A revision comes back through WhatsApp
 * or SIMGOS, and both change markers and spacing that nobody edited.
 */
function RevisionCompare({
  mine,
  mineLabel,
  onApply,
}: {
  mine: string;
  mineLabel: string;
  onApply?: (body: string) => void;
}): JSX.Element {
  const [pasted, setPasted] = useState('');
  const [ignoreFormatting, setIgnoreFormatting] = useState(true);
  const [onlyChanges, setOnlyChanges] = useState(false);

  const diff = useMemo(
    () => (pasted.trim() ? diffRevision(mine, pasted, { ignoreFormatting }) : null),
    [mine, pasted, ignoreFormatting],
  );

  const rows = diff
    ? onlyChanges
      ? withContext(diff.rows)
      : diff.rows.map((row) => ({ row, gap: false }))
    : [];

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="revision-paste" className="block text-xs font-medium text-fg-muted">
          Tempel SOAP yang sudah direvisi. Dibandingkan dengan{' '}
          <strong className="text-fg">{mineLabel}</strong>; teks ini tidak disimpan.
        </label>
        <textarea
          id="revision-paste"
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
          rows={6}
          placeholder="Tempel di sini…"
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs"
        />
      </div>

      <div className="flex flex-wrap gap-x-4">
        <label className="flex min-h-tap items-center gap-2 text-xs text-fg-muted">
          <input
            type="checkbox"
            checked={ignoreFormatting}
            onChange={(event) => setIgnoreFormatting(event.target.checked)}
          />
          Abaikan format (tebal, miring, spasi, baris kosong)
        </label>
        <label className="flex min-h-tap items-center gap-2 text-xs text-fg-muted">
          <input
            type="checkbox"
            checked={onlyChanges}
            onChange={(event) => setOnlyChanges(event.target.checked)}
          />
          Hanya yang berubah
        </label>
      </div>

      {diff ? (
        diff.identical ? (
          <p className="text-xs font-medium text-accent">
            Tidak ada perubahan isi{ignoreFormatting ? ' (format diabaikan)' : ''}.
          </p>
        ) : (
          <>
            <p className="text-xs text-fg-muted">
              <strong className="text-fg">{diff.changed}</strong> baris diubah ·{' '}
              <strong className="text-fg">{diff.added}</strong> ditambah ·{' '}
              <strong className="text-fg">{diff.removed}</strong> dihapus, dari{' '}
              <strong className="text-fg">{mineLabel}</strong> ke revisi.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-fg-muted">
              <span className="flex items-center gap-1">
                <span className="rounded bg-[var(--card-step-12-bg)] px-1 text-[var(--card-step-12-fg)]">
                  hijau
                </span>
                ada di revisi
              </span>
              <span className="flex items-center gap-1">
                <span className="rounded bg-[var(--card-step-1-bg)] px-1 text-[var(--card-step-1-fg)] line-through">
                  merah
                </span>
                hanya di catatan saya
              </span>
            </div>
            {onApply ? <ApplyRevision pasted={pasted} onApply={onApply} /> : null}
            <div className="max-h-[55vh] overflow-auto rounded-lg border border-border bg-bg-subtle p-3 font-mono text-xs leading-relaxed">
              {rows.map(({ row, gap }, index) => (
                <div key={index}>
                  {gap ? (
                    <p aria-hidden="true" className="text-fg-faint">
                      ⋯
                    </p>
                  ) : null}
                  <RevisionLine row={row} />
                </div>
              ))}
            </div>
          </>
        )
      ) : null}
    </div>
  );
}

/**
 * Changed rows with one unchanged line either side, and a gap mark where lines
 * were skipped. A change without its neighbours often cannot be placed:
 * "- 40 mg" means nothing until you see which drug is above it.
 */
function withContext(rows: readonly RevisionRow[]): Array<{ row: RevisionRow; gap: boolean }> {
  const keep = new Set<number>();
  rows.forEach((row, index) => {
    if (row.kind === 'same') return;
    keep.add(index - 1);
    keep.add(index);
    keep.add(index + 1);
  });
  const out: Array<{ row: RevisionRow; gap: boolean }> = [];
  let last = -1;
  rows.forEach((row, index) => {
    if (!keep.has(index)) return;
    out.push({ row, gap: last !== -1 && index !== last + 1 });
    last = index;
  });
  return out;
}

const ADDED = 'bg-[var(--card-step-12-bg)] text-[var(--card-step-12-fg)]';
const REMOVED = 'bg-[var(--card-step-1-bg)] text-[var(--card-step-1-fg)] line-through';

/**
 * One row. The sign in the gutter carries the meaning as well as the colour,
 * so the diff still reads for someone who cannot tell red from green.
 */
function RevisionLine({ row }: { row: RevisionRow }): JSX.Element {
  const sign = row.kind === 'added' ? '+' : row.kind === 'removed' ? '−' : row.kind === 'changed' ? '~' : ' ';
  return (
    <p className="flex gap-2 whitespace-pre-wrap break-words">
      <span aria-hidden="true" className="w-3 shrink-0 text-fg-faint">
        {sign}
      </span>
      <span className="min-w-0 flex-1">
        {row.kind === 'changed' ? (
          row.parts.map((part, index) => (
            <span
              key={index}
              className={part.type === 'insert' ? ADDED : part.type === 'delete' ? REMOVED : undefined}
            >
              {part.text}
            </span>
          ))
        ) : (
          <span
            className={row.kind === 'added' ? ADDED : row.kind === 'removed' ? REMOVED : 'text-fg-muted'}
          >
            {row.text || ' '}
          </span>
        )}
      </span>
    </p>
  );
}

/**
 * Take the chief's version as the note for this day.
 *
 * Applies the text EXACTLY as pasted, not the normalised form the diff above
 * compares. Normalisation drops bold markers and blank lines so that a round
 * trip through WhatsApp does not read as a change; writing that stripped text
 * back would silently reformat a note nobody edited.
 *
 * Two steps, because it replaces a whole day's note. What is on screen now
 * goes into Riwayat perubahan first (the editor's restore path snapshots
 * before it writes), so this is undoable.
 */
function ApplyRevision({
  pasted,
  onApply,
}: {
  pasted: string;
  onApply: (body: string) => void;
}): JSX.Element {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return undefined;
    const timer = window.setTimeout(() => setArmed(false), 5000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          if (!armed) {
            setArmed(true);
            return;
          }
          setArmed(false);
          onApply(pasted);
        }}
        className={[
          'min-h-tap rounded-lg border px-3 text-xs font-medium',
          armed ? 'border-danger text-danger' : 'border-accent text-accent',
        ].join(' ')}
      >
        {armed ? 'Ketuk lagi: ganti catatan hari ini' : 'Pakai versi revisi ini'}
      </button>
      <p className="text-[11px] text-fg-muted">
        Teks tempelan menggantikan catatan yang terbuka, persis seperti yang ditempel. Versi
        sekarang tersimpan di Riwayat perubahan.
      </p>
    </div>
  );
}
