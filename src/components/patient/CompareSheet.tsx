import { useEffect, useMemo, useState } from 'react';

import { Sheet } from '@/components/common/Sheet';
import { Segmented } from '@/components/common/ui';
import {
  fetchComparableEntries,
  type ComparableEntry,
} from '@/data/repositories/entries.repo';
import {
  compareSuggestions,
  defaultPartner,
  fullLabel,
  groupCompareOptions,
  relativeDay,
  entryName,
  type OpenNote,
} from '@/domain/compareOptions';
import { diffSegmentsByLine } from '@/domain/merge/threeWayMerge';
import { diffRevision, type RevisionRow } from '@/domain/format/revisionDiff';

/**
 * Two notes side by side, or one marked against the other.
 *
 * The question this answers is "what changed": whether the plan moved,
 * whether a lab is new, whether something was dropped by accident when
 * yesterday was carried forward, or what a version left out. Read-only,
 * deliberately. An editable second pane means two editors on one patient in
 * one tab, and the first time they disagree nobody can tell which is which.
 *
 * THE PICKER (2026-10-04 rebuild). It was two rows of chips, one per pane,
 * each holding every day, version and jaga note again. That was a wall of
 * near-identical pills, with the pair hard to find in it and the 13th entry
 * onward unreachable. Now:
 *
 *  - a PAIR at the top, "Dari" → "Ke", each one tap to change, with a swap;
 *  - shortcuts for the comparisons actually made (SOAP asli, Hari
 *    sebelumnya, the day's versions), which cover most uses in one tap;
 *  - one grouped list, opened for the side being changed: every date, newest
 *    first, its SOAP and then its versions and jaga notes, scrollable all the
 *    way back.
 */
export function CompareSheet({
  open,
  onOpenChange,
  patientId,
  todayBody,
  openNote,
  currentKey,
  onApplyRevision,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  /** The note open in the editor — a day's SOAP, a version or a jaga note. */
  todayBody: string;
  /** What that note is: its day, kind and name (`SOAP`, `Versi dr. AHA`). */
  openNote: OpenNote;
  /**
   * The key of the open note in the comparable list, so it is not offered
   * twice: once live, once as the stored copy under its own date.
   */
  currentKey: string;
  /**
   * Replace the note on screen with a pasted revision. The ONE write this
   * sheet can cause, and only from the revision mode. Absent when the open
   * note is not the day's SOAP.
   */
  onApplyRevision?: (body: string) => void;
}): JSX.Element {
  const [days, setDays] = useState<ComparableEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  /** "Dari": the older side, the diff's baseline. `null` is the open note. */
  const [from, setFrom] = useState<string | null>(null);
  /** "Ke": the newer side. Defaults to the open note. */
  const [to, setTo] = useState<string | null>(null);
  /** Which side's list is open, if any. */
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const [view, setView] = useState<'berdampingan' | 'perubahan'>('berdampingan');
  const [mode, setMode] = useState<'antar' | 'revisi'>('antar');

  const openDate = openNote.date;
  const openKind = openNote.kind;
  const openName = openNote.name;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoaded(false);
    setPicking(null);

    void fetchComparableEntries(patientId)
      .then((entries) => {
        if (cancelled) return;
        setDays(entries);
        setFrom(
          defaultPartner(entries, { date: openDate, kind: openKind, name: openName }, currentKey),
        );
        setTo(null);
        setLoaded(true);
      })
      .catch((error: unknown) => console.error('[compare] could not read entries', error));

    return () => {
      cancelled = true;
    };
  }, [open, patientId, currentKey, openDate, openKind, openName]);

  const groups = useMemo(
    () => groupCompareOptions(days, openNote, currentKey),
    [days, openNote, currentKey],
  );
  const suggestions = useMemo(
    () => compareSuggestions(days, openNote, currentKey),
    [days, openNote, currentKey],
  );
  const hasOthers = days.some((entry) => entry.key !== currentKey);

  /**
   * `null` is the note in the editor, read LIVE rather than from the list:
   * a copy taken when the sheet opened would go stale as you type while
   * looking authoritative.
   */
  const resolve = (
    key: string | null,
  ): { label: string; sub: string; body: string; open: boolean } | null => {
    if (key === null) {
      return {
        label: fullLabel(openDate, openName),
        sub: 'dibuka',
        body: todayBody,
        open: true,
      };
    }
    const found = days.find((entry) => entry.key === key);
    if (!found) return null;
    return {
      label: fullLabel(found.date, entryName(found)),
      sub: relativeDay(found.date, openDate),
      body: found.body,
      open: false,
    };
  };

  const left = resolve(from);
  const right = resolve(to);

  const leftBody = left?.body;
  const rightBody = right?.body;
  const segments = useMemo(
    () =>
      view === 'perubahan' && leftBody !== undefined && rightBody !== undefined
        ? diffSegmentsByLine(leftBody, rightBody)
        : null,
    [view, leftBody, rightBody],
  );
  const sameNote = from === to;

  const choose = (key: string | null): void => {
    if (picking === 'from') setFrom(key);
    if (picking === 'to') setTo(key);
    setPicking(null);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Bandingkan catatan"
      description="Hanya untuk dibaca. Perubahan tetap dilakukan di catatan itu sendiri."
    >
      <Segmented
        label="Jenis perbandingan"
        value={mode}
        onChange={setMode}
        options={[
          ['antar', 'Antar catatan'],
          ['revisi', 'Revisi tempelan'],
        ]}
      />

      {mode === 'revisi' ? (
        <div className="mt-3">
          <RevisionCompare
            mine={todayBody}
            mineLabel={fullLabel(openDate, openName)}
            {...(onApplyRevision
              ? {
                  onApply: (body: string) => {
                    onApplyRevision(body);
                    onOpenChange(false);
                  },
                }
              : {})}
          />
        </div>
      ) : !loaded ? (
        <p className="mt-4 text-sm text-fg-muted">Memuat…</p>
      ) : !hasOthers ? (
        <p className="mt-4 text-sm text-fg-muted">Belum ada catatan lain untuk dibandingkan.</p>
      ) : (
        <>
          {/* THE PAIR. Read left to right as the diff reads: from → to. */}
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-stretch gap-1.5">
            <Slot
              legend="Dari"
              pane={left}
              active={picking === 'from'}
              onClick={() => setPicking(picking === 'from' ? null : 'from')}
            />
            <button
              type="button"
              onClick={() => {
                setFrom(to);
                setTo(from);
              }}
              aria-label="Tukar sisi"
              title="Tukar sisi"
              className="flex min-h-tap min-w-tap items-center justify-center self-center rounded-full border border-border text-fg-muted hover:bg-bg-subtle"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M7 7h13l-4-4M17 17H4l4 4" />
              </svg>
            </button>
            <Slot
              legend="Ke"
              pane={right}
              active={picking === 'to'}
              onClick={() => setPicking(picking === 'to' ? null : 'to')}
            />
          </div>

          {picking ? (
            <OptionList
              heading={picking === 'from' ? 'Pilih catatan "Dari"' : 'Pilih catatan "Ke"'}
              groups={groups}
              selected={picking === 'from' ? from : to}
              other={picking === 'from' ? to : from}
              onChoose={choose}
              onClose={() => setPicking(null)}
            />
          ) : suggestions.length > 0 ? (
            /*
              Shortcuts compare the open note WITH something, so they set both
              sides: the suggestion on "Dari", the open note on "Ke".
            */
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-fg-faint">Cepat:</span>
              {suggestions.map((suggestion) => {
                const active = from === suggestion.key && to === null;
                return (
                  <button
                    key={suggestion.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setFrom(suggestion.key);
                      setTo(null);
                    }}
                    className={[
                      'min-h-tap rounded-full border px-3 text-xs',
                      active
                        ? 'border-accent bg-[var(--accent-soft)] font-medium text-accent'
                        : 'border-border text-fg-muted hover:bg-bg-subtle',
                    ].join(' ')}
                  >
                    {suggestion.label}
                    <span className="ml-1 opacity-70">{suggestion.detail}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {!picking ? (
            <>
              <div className="mt-4">
                <Segmented
                  label="Tampilan"
                  value={view}
                  onChange={setView}
                  options={[
                    ['berdampingan', 'Berdampingan'],
                    ['perubahan', 'Tandai perubahan'],
                  ]}
                />
              </div>

              {sameNote ? (
                <p className="mt-3 text-xs text-fg-muted">
                  Kedua sisi adalah catatan yang sama. Ganti salah satunya.
                </p>
              ) : view === 'perubahan' && segments ? (
                <>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-fg-muted">
                    <span className="flex items-center gap-1">
                      <span className="rounded bg-[var(--card-step-12-bg)] px-1 text-[var(--card-step-12-fg)]">
                        hijau
                      </span>
                      baru di “Ke”
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="rounded bg-[var(--card-step-1-bg)] px-1 text-[var(--card-step-1-fg)] line-through">
                        merah
                      </span>
                      hilang dari “Dari”
                    </span>
                  </div>
                  <pre className="mt-2 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-bg-subtle p-3 text-xs leading-relaxed">
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
                // Two columns from tablet up, stacked below: a 40-character
                // column on a phone is worse than scrolling.
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Pane legend="Dari" label={left?.label ?? '—'} body={left?.body ?? ''} />
                  <Pane legend="Ke" label={right?.label ?? '—'} body={right?.body ?? ''} />
                </div>
              )}
            </>
          ) : null}
        </>
      )}
    </Sheet>
  );
}

/** One side of the pair: what is on it, and the way to change it. */
function Slot({
  legend,
  pane,
  active,
  onClick,
}: {
  legend: string;
  pane: { label: string; sub: string; open: boolean } | null;
  active: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-expanded={active}
      onClick={onClick}
      className={[
        'flex min-h-tap min-w-0 flex-col items-start rounded-xl border px-3 py-2 text-left',
        active ? 'border-accent bg-[var(--accent-soft)]' : 'border-border bg-surface hover:bg-bg-subtle',
      ].join(' ')}
    >
      <span className="flex w-full items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-fg-faint">
        <span className="flex-1">{legend}</span>
        <span aria-hidden="true">{active ? '▴' : '▾'}</span>
      </span>
      <span className="w-full truncate text-sm font-medium text-fg">{pane?.label ?? 'Pilih…'}</span>
      {pane?.sub ? (
        <span
          className={[
            'text-[11px]',
            pane.open ? 'font-medium text-accent' : 'text-fg-muted',
          ].join(' ')}
        >
          {pane.sub}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Every note, by date. A date's SOAP is solid, its versions and jaga notes
 * dashed (a second colour would collide with "selected"). The note on the
 * other side is marked rather than hidden, so the list never changes shape
 * between the two sides.
 */
function OptionList({
  heading,
  groups,
  selected,
  other,
  onChoose,
  onClose,
}: {
  heading: string;
  groups: ReturnType<typeof groupCompareOptions>;
  selected: string | null;
  other: string | null;
  onChoose: (key: string | null) => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <div className="mt-3 rounded-xl border border-accent">
      <div className="flex items-center gap-2 border-b border-border px-3 py-1">
        <p className="flex-1 text-xs font-medium text-fg">{heading}</p>
        <button type="button" onClick={onClose} className="min-h-tap px-1 text-xs text-fg-muted">
          Tutup
        </button>
      </div>
      <ul className="max-h-[45vh] divide-y divide-border overflow-y-auto">
        {groups.map((group) => (
          <li key={group.date} className="px-3 py-2">
            <p className="mb-1.5 flex items-baseline gap-2 text-xs">
              <span className="font-semibold text-fg">{group.dateLabel}</span>
              {group.relative ? <span className="text-fg-faint">{group.relative}</span> : null}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {group.options.map((option) => {
                const isSelected = option.key === selected;
                const onOther = option.key === other;
                return (
                  <button
                    key={option.key ?? 'open'}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onChoose(option.key)}
                    className={[
                      'flex min-h-tap max-w-full items-center gap-1 rounded-full border px-3 text-xs',
                      option.kind === 'harian' ? '' : 'border-dashed',
                      isSelected
                        ? 'border-accent bg-[var(--accent-soft)] font-medium text-accent'
                        : 'border-border text-fg hover:bg-bg-subtle',
                    ].join(' ')}
                  >
                    <span className="truncate">{option.name}</span>
                    {option.open ? (
                      <span className="shrink-0 rounded bg-accent px-1 text-[10px] font-semibold text-white">
                        dibuka
                      </span>
                    ) : null}
                    {onOther && !isSelected ? (
                      <span className="shrink-0 text-[10px] text-fg-faint">sisi lain</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pane({ legend, label, body }: { legend: string; label: string; body: string }): JSX.Element {
  return (
    <div className="min-w-0">
      <p className="mb-1 truncate text-xs text-fg-muted">
        <span className="font-semibold uppercase tracking-wide text-fg-faint">{legend}</span>{' '}
        <span className="font-semibold text-fg">{label}</span>
      </p>
      <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-bg-subtle p-3 text-xs leading-relaxed">
        {body.trim() || '(kosong)'}
      </pre>
    </div>
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
