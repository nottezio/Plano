import { Link } from 'react-router-dom';

import { DenahPlanView } from './DenahPlanView';
import { buildDenah, denahLine, UNPLACED } from '@/domain/denah';
import { wardPlan } from '@/domain/denahPlan';
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
 * A ward with a transcribed floor plan is drawn against it — see
 * `denahPlan.ts`. This used to argue that reproducing the real geometry needed
 * a per-ward map "that someone has to draw and maintain", which was true right
 * up until the sheet for PJT Lantai 4 was handed over already drawn.
 *
 * Wards WITHOUT a plan still flow in a numeric grid, and that is the honest
 * fallback rather than a lesser one: a ward is only laid out against the wall
 * once somebody has checked it against the wall. Guessing a geometry would be
 * worse than ordering by number, because it would look authoritative.
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
      {wards.map((ward) => {
        const plan = wardPlan(ward.ward);
        if (plan) {
          return (
            <DenahPlanView
              key={ward.ward}
              plan={plan}
              patients={ward.rooms.flatMap((room) => room.beds.map((bed) => bed.patient))}
              today={today}
              showInitialsOnly={showInitialsOnly}
            />
          );
        }

        return (
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
        );
      })}
    </div>
  );
}
