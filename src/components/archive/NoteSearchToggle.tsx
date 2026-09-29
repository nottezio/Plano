import { useState } from 'react';

import type { ArchiveText } from '@/hooks/useArchiveText';
import { ARCHIVE_SCOPES, type ArchiveScope } from '@/domain/archiveSearch';

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

const SCOPES_KEY = 'visite.archive.scopes';

/** Which scopes the archive search covers, remembered on this device. */
export function useArchiveScopes(): [ReadonlySet<ArchiveScope>, (scope: ArchiveScope) => void] {
  const [scopes, setScopes] = useState<ReadonlySet<ArchiveScope>>(() => {
    try {
      const raw = localStorage.getItem(SCOPES_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      const valid = Array.isArray(parsed)
        ? parsed.filter((value): value is ArchiveScope =>
            ARCHIVE_SCOPES.some((scope) => scope.value === value),
          )
        : [];
      return new Set(valid.length > 0 ? valid : (['identitas', 'arsip'] as ArchiveScope[]));
    } catch {
      return new Set<ArchiveScope>(['identitas', 'arsip']);
    }
  });
  const toggle = (scope: ArchiveScope): void => {
    setScopes((current) => {
      const next = new Set(current);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      // Never nothing: an empty scope set would match nobody for any query.
      if (next.size === 0) return current;
      try {
        localStorage.setItem(SCOPES_KEY, JSON.stringify([...next]));
      } catch {
        // Lasts for this visit.
      }
      return next;
    });
  };
  return [scopes, toggle];
}

/** "Cari di: [Identitas] [Catatan arsip] [Isi SOAP]" — any combination. */
export function ArchiveScopePicker({
  scopes,
  onToggle,
  status,
}: {
  scopes: ReadonlySet<ArchiveScope>;
  onToggle: (scope: ArchiveScope) => void;
  status: ArchiveText;
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Cari di">
      <span className="text-[11px] text-fg-faint">Cari di</span>
      {ARCHIVE_SCOPES.map((scope) => {
        const on = scopes.has(scope.value);
        return (
          <button
            key={scope.value}
            type="button"
            aria-pressed={on}
            title={scope.hint}
            onClick={() => onToggle(scope.value)}
            className={[
              'min-h-tap rounded-full border px-2.5 text-xs [@media(pointer:fine)]:min-h-8',
              on ? 'border-accent bg-[var(--accent-soft)] font-medium text-accent' : 'border-border text-fg-muted',
            ].join(' ')}
          >
            {on ? '✓ ' : ''}
            {scope.label}
          </button>
        );
      })}
      {scopes.has('soap') && status.loading ? (
        <span className="text-[11px] text-fg-faint" aria-live="polite">
          Memuat SOAP {status.loaded}/{status.total}…
        </span>
      ) : null}
    </div>
  );
}
