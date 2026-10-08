import { useEffect, useRef, useState } from 'react';

import { formatDmy, parseDmy } from '@/domain/dateDmy';
import { IconCalendar } from './Icons';

/**
 * A date field that always reads tgl/bln/tahun.
 *
 * `<input type="date">` renders in the browser's locale, so on a phone set to
 * English (US) every date in the app read month first — "10/09/2026" for
 * 9 Oktober (see `domain/dateDmy`). This shows the date as text, day first,
 * and keeps a native date input only to open the platform's calendar from the
 * button. Typing works too: "9/10", "9-10-26", "09/10/2026" all read as
 * 9 Oktober. Anything unreadable is put back on blur rather than saved.
 *
 * `value` and `onChange` are ISO (`YYYY-MM-DD`), as every caller stores it.
 */
export function DateField({
  value,
  onChange,
  id,
  ariaLabel,
  min,
  max,
  allowEmpty = false,
  className = '',
  inputClassName = '',
}: {
  value: string;
  onChange: (iso: string) => void;
  id?: string;
  ariaLabel?: string;
  min?: string;
  max?: string;
  /** Clearing the text saves '' (a discharge plan can be removed). */
  allowEmpty?: boolean;
  className?: string;
  inputClassName?: string;
}): JSX.Element {
  const [draft, setDraft] = useState(formatDmy(value));
  const [editing, setEditing] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(formatDmy(value));
  }, [value, editing]);

  const commit = (): void => {
    setEditing(false);
    const text = draft.trim();
    if (!text) {
      if (allowEmpty && value) onChange('');
      else setDraft(formatDmy(value));
      return;
    }
    // "9/10" without a year: this year, or the year of the current value.
    const withYear = /^\s*\d{1,2}\s*[/.\-\s]\s*\d{1,2}\s*$/.test(text)
      ? `${text}/${(value || new Date().toISOString()).slice(0, 4)}`
      : text;
    const iso = parseDmy(withYear);
    if (!iso || (min && iso < min) || (max && iso > max)) {
      setDraft(formatDmy(value));
      return;
    }
    setDraft(formatDmy(iso));
    if (iso !== value) onChange(iso);
  };

  return (
    <div className={`relative flex min-w-0 items-stretch ${className}`}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="tgl/bln/tahun"
        aria-label={ariaLabel}
        value={draft}
        onFocus={() => setEditing(true)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setDraft(formatDmy(value));
            event.currentTarget.blur();
          }
        }}
        className={`min-h-tap w-full min-w-0 rounded-xl border border-border bg-surface py-0 pl-3 pr-11 text-sm tabular-nums text-fg outline-none placeholder:text-fg-faint focus:border-accent [@media(pointer:fine)]:min-h-10 ${inputClassName}`}
      />
      <button
        type="button"
        aria-label="Pilih dari kalender"
        onClick={() => {
          const picker = pickerRef.current;
          if (!picker) return;
          try {
            if (typeof picker.showPicker === 'function') picker.showPicker();
            else picker.click();
          } catch {
            picker.focus();
          }
        }}
        className="absolute inset-y-0 right-0 flex min-w-tap items-center justify-center rounded-r-xl text-fg-muted hover:text-fg"
      >
        <IconCalendar width={18} height={18} aria-hidden="true" />
      </button>
      {/* The calendar only. Never shown: its own text would be month-first. */}
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        {...(min ? { min } : {})}
        {...(max ? { max } : {})}
        onChange={(event) => {
          const next = event.target.value;
          if (next && next !== value) onChange(next);
          if (!next && allowEmpty && value) onChange('');
        }}
        className="pointer-events-none absolute bottom-0 right-0 h-px w-px opacity-0"
      />
    </div>
  );
}
