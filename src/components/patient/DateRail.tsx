import { useEffect, useRef } from 'react';

import { formatShortDate, relativeDayLabel } from '@/domain/clinicalDate';
import type { ClinicalDate } from '@/domain/types';
import { IGD_ENTRY } from '@/domain/clinicalDate';

/**
 * SPEC F4 — horizontal date rail, newest on the right, today auto-selected.
 * Days that already have content are marked, so a resident scanning back for
 * "the day we started ceftriaxone" can see where to look.
 */
export function DateRail({
  dates,
  onClear,
  selected,
  today,
  datesWithContent,
  onSelect,
  orientation = 'horizontal',
}: {
  dates: ClinicalDate[];
  /** Clear a day's note. Omitted where there is no room for the control. */
  onClear?: (date: ClinicalDate) => void;
  selected: ClinicalDate;
  today: ClinicalDate;
  datesWithContent: ReadonlySet<ClinicalDate>;
  onSelect: (date: ClinicalDate) => void;
  /** Horizontal strip on phone; a stacked list in the desktop sidebar. */
  orientation?: 'horizontal' | 'vertical';
}): JSX.Element {
  const pickerRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [selected]);

  return (
    <div
      className={
        orientation === 'vertical'
          ? 'flex flex-col gap-1'
          : 'flex items-center gap-2 overflow-x-auto border-b border-border px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      }
    >
      {/*
        The admission note sits above the dated entries, always.
        
        It is not a day, so it cannot be sorted among them — and it is the one
        entry you look for by name rather than by date.
      */}
      <button
        type="button"
        onClick={() => onSelect(IGD_ENTRY)}
        aria-current={selected === IGD_ENTRY}
        className={[
          'flex min-h-tap w-full items-center gap-2 rounded-lg border px-3 text-left text-xs',
          selected === IGD_ENTRY
            ? 'border-accent bg-accent font-medium text-white'
            : 'border-border text-fg-muted',
        ].join(' ')}
      >
        <span className="flex-1">SOAP IGD</span>
        {datesWithContent.has(IGD_ENTRY) ? <span aria-hidden="true">·</span> : null}
      </button>

      {dates.map((date) => {
        const active = date === selected;
        const hasContent = datesWithContent.has(date);

        return (
          <div
            key={date}
            className={[
              'flex shrink-0 items-center',
              orientation === 'vertical' ? 'w-full gap-1' : '',
            ].join(' ')}
          >
          <button
            ref={active ? selectedRef : undefined}
            type="button"
            onClick={() => onSelect(date)}
            aria-current={active ? 'date' : undefined}
            className={[
              'flex min-h-tap shrink-0 rounded-lg px-3 py-1 text-xs',
              orientation === 'vertical'
                ? 'w-full min-w-0 flex-row items-center justify-between gap-2 text-left'
                : 'flex-col items-center justify-center',
              active ? 'bg-accent font-medium text-white' : 'text-fg-muted',
            ].join(' ')}
          >
            <span>{date === today ? 'Hari ini' : relativeDayLabel(date, today)}</span>
            <span className={active ? 'opacity-90' : 'opacity-60'}>
              {formatShortDate(date)}
              {hasContent ? ' ·' : ''}
            </span>
          </button>

          {/*
            Only where there is something to clear, and only in the sidebar.
            A delete control on an empty day is a control that can only do
            nothing, and on the horizontal phone rail there is no room for one
            that is not a mis-tap waiting to happen.
          */}
          {onClear && hasContent && orientation === 'vertical' ? (
            <button
              type="button"
              aria-label={`Hapus catatan ${formatShortDate(date)}`}
              onClick={() => onClear(date)}
              className="min-h-tap min-w-[28px] shrink-0 text-xs text-fg-faint hover:text-danger"
            >
              ×
            </button>
          ) : null}
          </div>
        );
      })}

      {/*
        Any date, not just the ones already in the rail.
        The rail lists days that have a note plus today, which is right for
        navigation but leaves no way to back-fill a day that was missed or to
        pre-write one. A native date input is deliberate: it brings each
        platform's own calendar, including the year jump needed for a long
        admission, and needs no picker component of our own.
      */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => {
            // showPicker() is unsupported on older Safari; focus+click is the
            // fallback that still opens the native calendar there.
            const input = pickerRef.current;
            if (!input) return;
            if (typeof input.showPicker === 'function') input.showPicker();
            else input.click();
          }}
          className="flex min-h-tap w-full items-center gap-1 rounded-lg border border-dashed border-border-strong px-3 text-xs text-fg-muted"
        >
          <span aria-hidden="true">📅</span>
          Tanggal lain
        </button>
        <input
          ref={pickerRef}
          type="date"
          value={selected}
          aria-label="Pilih tanggal catatan"
          onChange={(event) => {
            if (event.target.value) onSelect(event.target.value as ClinicalDate);
          }}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        />
      </div>
    </div>
  );
}
