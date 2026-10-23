import { useMemo, useState, type ReactNode } from 'react';

import type { ClinicalDate } from '@/domain/types';
import { SCHEDULE_PERIOD, upcomingPoli, weekPoli, weekdayName } from '@/domain/poli/schedule';

/**
 * Presentational pieces of the patient page, split out of PatientPage
 * (2026-10-23) so the route file holds the screen's state and layout only.
 */

export function Banner({
  tone,
  children,
}: {
  tone: 'info' | 'warn' | 'muted';
  children: ReactNode;
}): JSX.Element {
  const toneClass =
    tone === 'warn'
      ? 'border-[var(--card-step-2-accent)] text-[var(--card-step-2-accent)]'
      : tone === 'info'
        ? 'border-border bg-bg-subtle'
        : 'border-border text-fg-muted';

  return (
    <div className={`flex items-center gap-3 border-b px-4 py-2 text-xs ${toneClass}`}>
      {children}
    </div>
  );
}

/** Urgency of a Periksa lagi finding, in words, not colour alone. */
export function FindingTag({ level }: { level: 'isi' | 'kemarin' | 'cek' }): JSX.Element {
  return (
    <span
      className={[
        'shrink-0 rounded-sm border px-1 text-[11px] font-bold uppercase tracking-wide',
        level === 'isi'
          ? 'border-danger text-danger'
          : level === 'kemarin'
            ? 'border-[var(--warn-strong)] text-[var(--warn-strong)]'
            : 'border-border-strong text-fg-muted',
      ].join(' ')}
    >
      {level === 'isi' ? 'Isi' : level === 'kemarin' ? 'Kemarin' : 'Cek'}
    </span>
  );
}

/**
 * The day counters that did not move since yesterday, one chip each, in a
 * row that scrolls sideways: tap the counter to go to it, +1 to advance just
 * that one. Choosing counter by counter is the point; which ones should move
 * (an antibiotic course that ended, a post-procedure day that keeps running)
 * is a clinical judgement, so there is no "all +1".
 */
export function MarkerChips({
  markers,
  onJump,
  onBump,
}: {
  markers: ReadonlyArray<{ text: string; value: number; at: number }>;
  onJump: (marker: { text: string; at: number }, index: number) => void;
  onBump: (marker: { text: string; at: number }, index: number) => void;
}): JSX.Element {
  const [bumped, setBumped] = useState<ReadonlySet<number>>(new Set());
  // Occurrence index among counters with the same text, for relocating one
  // after edits have moved it.
  const occurrence = (index: number): number =>
    markers.slice(0, index).filter((other) => other.text === markers[index]?.text).length;

  return (
    <div className="flex w-full gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]" role="group" aria-label="Hitungan hari">
      {markers.map((marker, index) => (
        <span
          key={`${marker.text}-${String(marker.at)}`}
          className={[
            'flex shrink-0 items-stretch overflow-hidden rounded-full border text-xs',
            bumped.has(index) ? 'border-border opacity-60' : 'border-[var(--warn-strong)]',
          ].join(' ')}
        >
          <button
            type="button"
            onClick={() => onJump(marker, occurrence(index))}
            title="Tampilkan di catatan"
            className="min-h-tap px-2.5 font-mono [@media(pointer:fine)]:min-h-7"
          >
            {bumped.has(index) ? `✓ ${marker.text.replace(/\d+$/, String(marker.value + 1))}` : marker.text}
          </button>
          {bumped.has(index) ? null : (
            <button
              type="button"
              onClick={() => {
                onBump(marker, occurrence(index));
                setBumped((current) => new Set(current).add(index));
              }}
              aria-label={`Naikkan ${marker.text} satu hari`}
              className="min-h-tap border-l border-[var(--warn-strong)] bg-[var(--warn-soft)] px-2 font-semibold [@media(pointer:fine)]:min-h-7"
            >
              +1
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

/**
 * The DPJP card in the panel sidebar (compact, 2026-10-10).
 *
 * It had grown to seven rows: a header, the full name on its own line, Kirim,
 * Format, Rencana, Poli and Lalu, each clinic spelled out with its hours. The
 * name now shares the header, and the clinics are ONE line — the next one —
 * that opens to the consultant's whole coming week (Avi). The week answers
 * the question the two lines were read for ("can a referral still go this
 * week?") better than two dates did, and costs nothing until it is asked.
 */
export function DpjpSideCard({
  dpjp,
  rows,
  today,
}: {
  dpjp: { id: string; initials: string; name: string } | null;
  rows: ReadonlyArray<{ label: string; value: ReactNode; strong?: boolean }>;
  today: ClinicalDate;
}): JSX.Element {
  const [weekOpen, setWeekOpen] = useState(false);
  const week = useMemo(() => (dpjp ? weekPoli(dpjp.id, today) : []), [dpjp, today]);
  const next = dpjp ? (upcomingPoli(dpjp.id, today, 1)[0] ?? null) : null;
  const when = (entry: { weekday: number; inDays: number; date: string }): string =>
    entry.inDays === 0
      ? 'Hari ini'
      : entry.inDays === 1
        ? 'Besok'
        : `${weekdayName(entry.weekday)} ${entry.date.slice(8)}/${entry.date.slice(5, 7)}`;
  return (
    <section className="shrink-0 overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex min-h-tap items-center gap-2 px-3 [@media(pointer:fine)]:min-h-10">
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-fg-faint">DPJP</span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium" title={dpjp?.name}>
          {dpjp ? dpjp.name : <span className="text-fg-faint">belum dikenali</span>}
        </span>
        {dpjp ? (
          <span className="shrink-0 rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-xs font-semibold text-accent">
            {dpjp.initials}
          </span>
        ) : null}
      </div>
      {rows.length > 0 || dpjp ? (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-t border-border px-3 py-2 text-xs">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-fg-faint">{row.label}</dt>
              <dd className={row.strong ? 'font-medium text-accent' : 'text-fg-muted'}>{row.value}</dd>
            </div>
          ))}
          {dpjp ? (
            <div className="contents">
              <dt className="text-fg-faint">Poli</dt>
              <dd className="min-w-0 text-fg-muted">
                {next ? (
                  <button
                    type="button"
                    aria-expanded={weekOpen}
                    onClick={() => setWeekOpen((open) => !open)}
                    title="Lihat jadwal poli minggu ini"
                    className="-my-1 flex min-h-8 w-full min-w-0 items-center gap-1 text-left text-accent"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {when(next)} · {next.slot.clinic}
                    </span>
                    <span aria-hidden="true" className={`shrink-0 transition-transform ${weekOpen ? 'rotate-90' : ''}`}>
                      ›
                    </span>
                  </button>
                ) : (
                  `Tidak ada di jadwal poli ${SCHEDULE_PERIOD}`
                )}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {weekOpen && dpjp ? (
        <div className="border-t border-border px-3 py-2 text-xs">
          <p className="mb-1 font-semibold text-fg-faint">Poli {dpjp.initials} · 7 hari ke depan</p>
          {week.length === 0 ? (
            <p className="text-fg-muted">Tidak ada poli dalam 7 hari ke depan.</p>
          ) : (
            <ul className="space-y-1">
              {week.map((entry) => (
                <li key={`${entry.date}-${entry.slot.clinic}`} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2">
                  <span className={entry.inDays <= 1 ? 'font-semibold' : 'text-fg-muted'}>{when(entry)}</span>
                  <span className="min-w-0">
                    {entry.slot.clinic}
                    <span className="block text-fg-faint">{entry.slot.time}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-[11px] text-fg-faint">Jadwal {SCHEDULE_PERIOD}</p>
        </div>
      ) : null}
    </section>
  );
}
