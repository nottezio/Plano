import { useState } from 'react';

import type { ArchiveText } from '@/hooks/useArchiveText';

const KEY = 'visite.archive.searchNotes';

/**
 * "Search inside archived notes", remembered per device.
 *
 * Per device, like the board's order: it decides whether this device reads
 * every archived patient's notes, which is a cost paid on this device's
 * connection and storage.
 */
export function useSearchNotesPreference(): [boolean, (next: boolean) => void] {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  const set = (next: boolean): void => {
    setOn(next);
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      // No storage: lasts for this visit.
    }
  };
  return [on, set];
}

export function NoteSearchToggle({
  on,
  onChange,
  status,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  status: ArchiveText;
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className="flex min-h-tap items-center gap-2 text-left text-xs text-fg-muted"
      >
        <span
          aria-hidden="true"
          className={[
            'relative h-5 w-9 shrink-0 rounded-full transition-colors',
            on ? 'bg-accent' : 'bg-border-strong',
          ].join(' ')}
        >
          <span
            className={[
              'absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow transition-all',
              on ? 'left-[18px]' : 'left-0.5',
            ].join(' ')}
          />
        </span>
        Cari juga di isi catatan arsip (SOAP &amp; catatan pasien)
      </button>
      {on && status.loading ? (
        <span className="text-[11px] text-fg-faint" aria-live="polite">
          Memuat catatan {status.loaded}/{status.total}…
        </span>
      ) : null}
    </div>
  );
}
