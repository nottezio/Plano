import { useEffect, useRef } from 'react';

import { formatShortDate, relativeDayLabel } from '@/domain/clinicalDate';
import type { ClinicalDate } from '@/domain/types';

/**
 * SPEC F4 — horizontal date rail, newest on the right, today auto-selected.
 * Days that already have content are marked, so a resident scanning back for
 * "the day we started ceftriaxone" can see where to look.
 */
export function DateRail({
  dates,
  selected,
  today,
  datesWithContent,
  onSelect,
}: {
  dates: ClinicalDate[];
  selected: ClinicalDate;
  today: ClinicalDate;
  datesWithContent: ReadonlySet<ClinicalDate>;
  onSelect: (date: ClinicalDate) => void;
}): JSX.Element {
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [selected]);

  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-border px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {dates.map((date) => {
        const active = date === selected;
        return (
          <button
            key={date}
            ref={active ? selectedRef : undefined}
            type="button"
            onClick={() => onSelect(date)}
            aria-current={active ? 'date' : undefined}
            className={[
              'flex min-h-tap shrink-0 flex-col items-center justify-center rounded-lg px-3 py-1 text-xs',
              active ? 'bg-accent font-medium text-white' : 'text-fg-muted',
            ].join(' ')}
          >
            <span>{date === today ? 'Hari ini' : relativeDayLabel(date, today)}</span>
            <span className={active ? 'opacity-90' : 'opacity-60'}>
              {formatShortDate(date)}
              {datesWithContent.has(date) ? ' ·' : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
