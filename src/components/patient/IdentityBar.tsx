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
      // Tinted and taller. This is the line that answers "am I in the right
      // chart", and it was competing with the note for attention by looking
      // exactly like it.
      className="w-full border-b border-border px-4 py-1 text-left"
      style={{ backgroundColor: 'var(--sec-identitas)' }}
    >
      <span className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-base">{label}</span>
        <span className="shrink-0 whitespace-nowrap text-[11px] text-fg-muted">
          Hari ke-{hariRawat}
        </span>
      </span>

      <span className="mt-0.5 flex flex-wrap items-baseline gap-x-3 text-xs text-fg-muted">
        {patient.mrn ? (
          <span className="whitespace-nowrap font-medium">RM {patient.mrn}</span>
        ) : null}
        {patient.age !== undefined ? <span>{patient.age} th</span> : null}
        {patient.sex ? <span>{patient.sex}</span> : null}
        {location ? <span className="min-w-0 truncate">{location}</span> : null}
      </span>
    </button>
  );
}
