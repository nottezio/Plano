import { formatLocation } from '@/domain/identity';
import { initials } from '@/domain/board';
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
  const label = !name ? 'Tanpa nama' : showInitialsOnly ? initials(name) : name;
  const location = formatLocation(patient);

  return (
    <button
      type="button"
      onClick={onEdit}
      // Padding on every breakpoint. `xl:px-0` let the name sit flush against
      // the column edge, which on desktop is the sidebar border — so the name
      // read as if it were touching the navigation.
      className="sticky top-0 z-20 flex min-h-tap w-full items-center gap-3 border-b border-border bg-bg/95 px-4 text-left backdrop-blur"
    >
      <span className="min-w-0 shrink truncate text-sm font-semibold">{label}</span>
      {/* The location may be long; it truncates before the name does. */}
      {location ? (
        <span className="min-w-0 flex-1 truncate text-right text-xs text-fg-muted">
          {location}
        </span>
      ) : (
        <span className="flex-1" />
      )}
      <span className="shrink-0 whitespace-nowrap text-[11px] text-fg-faint">
        Hari ke-{hariRawat}
      </span>
    </button>
  );
}
