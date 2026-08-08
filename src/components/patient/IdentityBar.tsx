import type { Patient } from '@/domain/types';

/**
 * Sticky identity strip.
 *
 * Once the note is scrolled past its opening block there is nothing on screen
 * saying which patient it belongs to — and the one mistake this app must not
 * make easy is writing today's findings into the wrong chart. It stays put.
 *
 * Deliberately minimal: name, bed, day of admission. The full identity line is
 * in the note itself and in the header form; repeating it here would take space
 * from the text.
 */
export function IdentityBar({
  patient,
  showInitialsOnly,
  hariRawat,
  onEdit,
}: {
  patient: Patient;
  showInitialsOnly: boolean;
  hariRawat: number;
  onEdit: () => void;
}): JSX.Element {
  const name = patient.name?.trim();
  const label = !name
    ? 'Tanpa nama'
    : showInitialsOnly
      ? name
          .replace(/\b(Tn|Ny|Nn|An|Sdr|Sdri)\.?\s*/gi, '')
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 3)
          .map((word) => word[0]?.toUpperCase() ?? '')
          .join('.')
      : name;

  const location = [patient.ward, patient.bed].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      onClick={onEdit}
      className="sticky top-0 z-20 flex min-h-tap w-full items-center gap-2 border-b border-border bg-bg/95 px-4 text-left backdrop-blur xl:px-0"
    >
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{label}</span>
      {location ? (
        <span className="shrink-0 text-xs text-fg-muted">{location}</span>
      ) : null}
      <span className="shrink-0 text-[11px] text-fg-faint">Hari ke-{hariRawat}</span>
    </button>
  );
}
