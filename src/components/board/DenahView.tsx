import { Link } from 'react-router-dom';

import { buildDenah, denahLine, UNPLACED } from '@/domain/denah';
import type { ClinicalDate, Patient } from '@/domain/types';

/**
 * The ward drawn as rooms, the way the printed denah is.
 *
 * The list view answers "who do I have"; this answers "what is in 418", which
 * is the question you have standing in the corridor. Each room is a box, beds
 * are numbered inside it, and empty beds are shown as empty — an omitted bed is
 * indistinguishable from a bed that does not exist, and on a floor plan that
 * difference is the whole point.
 *
 * Rooms flow in a responsive grid rather than being positioned to match the
 * physical building. Reproducing the real geometry would need a per-ward map
 * that someone has to draw and maintain, and it would be wrong the first time a
 * bed is added. Numeric order is what the printed sheet is read by anyway.
 */
export function DenahView({
  patients,
  today,
  showInitialsOnly,
}: {
  patients: readonly Patient[];
  today: ClinicalDate;
  showInitialsOnly: boolean;
}): JSX.Element {
  const wards = buildDenah(patients);

  return (
    <div className="px-4 pb-4">
      {wards.map((ward) => (
        <section key={ward.ward} className="mt-4 first:mt-1">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-faint">
            {ward.ward}
          </h2>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {ward.rooms.map((room) => (
              <div
                key={`${ward.ward}-${room.room}`}
                className="rounded-lg border border-border bg-surface p-2"
              >
                <p className="mb-1 text-xs font-semibold">
                  {room.room === UNPLACED || room.room === '—'
                    ? 'Tanpa kamar'
                    : `Kamar ${room.room}`}
                  <span className="ml-1 font-normal text-fg-faint">
                    ({room.beds.length})
                  </span>
                </p>

                <ol className="space-y-1">
                  {room.beds.map(({ bed, patient }) => (
                    <li key={patient.id} className="flex gap-2">
                      <span className="w-4 shrink-0 text-right text-[11px] text-fg-faint">
                        {bed || '·'}
                      </span>
                      <Link
                        to={`/p/${patient.id}/${today}`}
                        className="min-w-0 flex-1 truncate text-[11px] leading-snug text-fg hover:underline"
                        title={denahLine(patient, false)}
                      >
                        {denahLine(patient, showInitialsOnly)}
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
