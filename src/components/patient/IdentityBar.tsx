import { formatLocation } from '@/domain/identity';
import { initials } from '@/domain/board';
import type { Patient } from '@/domain/types';

/**
 * The identity strip.
 *
 * Once the note is scrolled past its opening block there is nothing on screen
 * saying which patient it belongs to — and the one mistake this app must not
 * make easy is writing today's findings into the wrong chart.
 *
 * It carries NO `sticky` class of its own, deliberately. It is rendered as the
 * second row of `PatientPage`'s sticky `<header>`, so it follows the scroll as
 * part of that one bar. Two independently sticky bars stack, which previously
 * cost a third of a phone screen and hid this text behind the header above it.
 *
 * This docblock used to say "Sticky identity strip … It stays put" while the
 * class had no `sticky` on it and the component was rendered below the header
 * in the scrolling column. If you are moving this component, the stickiness
 * lives in the PARENT — check there before adding a class here.
 *
 * Deliberately minimal: name, RM, bed, day of admission. The full identity line
 * is in the note itself and in the header form; repeating it here would take
 * space from the text.
 */
export function IdentityBar({
  patient,
  showInitialsOnly,
  onEdit,
}: {
  patient: Patient;
  showInitialsOnly: boolean;
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
      className="w-full border-b border-border px-4 py-0.5 text-left"
      style={{ backgroundColor: 'var(--sec-identitas)' }}
    >
      {/*
        One line from `sm` up, two on a phone.

        `Hari ke-N` is GONE from here. The row above already ends with
        "· Hari rawat ke-2" — the same number, forty pixels away, in a bar whose
        whole problem is height. One fact, one place.

        Below `sm` the name still gets its own line: a name plus RM plus bed
        truncates to uselessness at 360 px, and the identity row exists
        precisely so that none of it has to be guessed at.
      */}
      <span className="flex flex-col sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3">
        <span className="min-w-0 truncate text-sm font-semibold sm:shrink-0 sm:text-[15px]">
          {label}
        </span>
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 text-xs text-fg-muted">
          {patient.mrn ? (
            <span className="whitespace-nowrap font-medium">RM {patient.mrn}</span>
          ) : null}
          {patient.age !== undefined ? <span>{patient.age} th</span> : null}
          {patient.sex ? <span>{patient.sex}</span> : null}
          {location ? <span className="min-w-0 truncate">{location}</span> : null}
        </span>
      </span>
    </button>
  );
}
