import { initials } from '@/domain/board';
import { isMismatch, useClipboardNote } from '@/store/useClipboardNote';
import { useSession } from '@/store/useSession';
import { IconClose } from './Icons';

function clock(at: number): string {
  const date = new Date(at);
  return `${String(date.getHours()).padStart(2, '0')}.${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * "Terakhir disalin: SOAP harian · Tn. X · 11.34", always in view.
 *
 * Amber when a different patient's page is open: that is the moment a paste
 * into SIMGOS would land in the wrong chart.
 */
export function ClipboardPill({
  className = '',
  variant = 'floating',
}: {
  className?: string;
  /** `row`: a line inside the sidebar's context card, no box of its own. */
  variant?: 'floating' | 'row';
}): JSX.Element | null {
  const last = useClipboardNote((state) => state.last);
  const openPatientId = useClipboardNote((state) => state.openPatientId);
  const dismiss = useClipboardNote((state) => state.dismiss);
  // Same privacy rule as the board: initials only, no RM, when that is on.
  const initialsOnly = useSession((state) => state.settings().privacy.boardShowInitialsOnly);
  if (!last) return null;

  const wrong = isMismatch(last, openPatientId);
  const who = initialsOnly ? initials(last.patientName) || '—' : last.patientName || 'Tanpa nama';

  if (variant === 'row') {
    return (
      <div
        role="status"
        title={`Terakhir disalin: ${last.what} · ${who} · ${clock(last.at)}`}
        className={[
          'flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] leading-tight',
          wrong ? 'bg-[var(--warn-soft)] text-fg' : 'text-fg-muted',
          className,
        ].join(' ')}
      >
        <span aria-hidden="true" className="shrink-0">
          📋
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-fg">{who}</span>
          <span className="block truncate">
            {wrong ? 'Pasien LAIN · ' : ''}
            {last.what} · {clock(last.at)}
          </span>
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Tutup keterangan clipboard"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-fg-faint hover:bg-bg-subtle"
        >
          <IconClose width={12} height={12} />
        </button>
      </div>
    );
  }

  return (
    <div
      role="status"
      className={[
        'flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] leading-snug shadow-sm',
        wrong
          ? 'border-[var(--warn-strong)] bg-[var(--warn-soft)] text-fg'
          : 'border-border bg-surface text-fg-muted',
        className,
      ].join(' ')}
    >
      <span aria-hidden="true">📋</span>
      <span className="min-w-0 flex-1">
        <span className="block">
          {wrong ? 'Clipboard berisi pasien LAIN' : 'Terakhir disalin'} · {last.what} · {clock(last.at)}
        </span>
        <span className="block truncate text-[13px] font-semibold text-fg">
          {who}
          {last.mrn && !initialsOnly ? <span className="font-mono text-[11px] font-normal"> · RM {last.mrn}</span> : null}
        </span>
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Tutup keterangan clipboard"
        className="-m-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-fg-muted hover:bg-bg-subtle"
      >
        <IconClose />
      </button>
    </div>
  );
}
