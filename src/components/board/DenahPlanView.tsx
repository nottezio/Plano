import { Link } from 'react-router-dom';

import { denahLine, placeInPlan, type PlacedRoom } from '@/domain/denah';
import { planRooms, type DenahColumn, type DenahRoomSlot, type WardPlan } from '@/domain/denahPlan';
import type { ClinicalDate, Patient } from '@/domain/types';

/**
 * One ward drawn against its transcribed floor plan.
 *
 * Three columns in the printed order, rooms stacked down each. Row heights are
 * deliberately NOT aligned across columns: 419 holds four beds and 402 holds
 * one, and forcing shared rows would either stretch the small rooms or clip the
 * large ones. The sheet is read column by column, so the columns are what is
 * preserved.
 */
export function DenahPlanView({
  plan,
  patients,
  today,
  showInitialsOnly,
}: {
  plan: WardPlan;
  patients: readonly Patient[];
  today: ClinicalDate;
  showInitialsOnly: boolean;
}): JSX.Element {
  const { rooms, strays } = placeInPlan(patients, planRooms(plan));
  const byRoom = new Map(rooms.map((room) => [room.room, room]));

  const room = (slot: DenahRoomSlot): JSX.Element => (
    <Room
      key={slot.room}
      placed={byRoom.get(slot.room)}
      slot={slot}
      today={today}
      showInitialsOnly={showInitialsOnly}
    />
  );

  const column = (blocks: DenahColumn[], key: string): JSX.Element => (
    <div key={key} className="flex min-w-0 flex-col gap-2">
      {blocks.map((block, index) =>
        block.landmark ? (
          <div
            key={`${key}-landmark-${String(index)}`}
            /*
              The nurse station is a landmark, not a room. Given the same box
              treatment it reads as a room with nobody in it, which is the one
              thing it must not look like — so it is filled and centred instead,
              the way the printed sheet shades it.
            */
            className="flex min-h-[96px] flex-1 items-center justify-center rounded-lg bg-[var(--warn-strong)] p-2 text-center text-[11px] font-bold uppercase leading-tight tracking-wide text-white"
          >
            {block.landmark}
            <br />
            {plan.ward}
          </div>
        ) : (
          <div key={`${key}-rooms-${String(index)}`} className="flex flex-col gap-2">
            {(block.rooms ?? []).map(room)}
          </div>
        ),
      )}
    </div>
  );

  return (
    <div className="px-4 pb-4">
      <h2 className="mb-2 mt-1 text-xs font-semibold uppercase tracking-wide text-fg-faint">
        {plan.ward}
      </h2>

      {/* The two long rooms across the top of the sheet. */}
      <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-2">{plan.header.map(room)}</div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_0.7fr_1fr]">
        {column(plan.columns[0], 'left')}
        {column(plan.columns[1], 'centre')}
        {column(plan.columns[2], 'right')}
      </div>

      {strays.length > 0 ? (
        <div className="mt-3 rounded-lg border border-[var(--danger)] p-2">
          <p className="mb-1 text-[11px] font-semibold text-fg">
            Di luar denah {plan.ward}
          </p>
          {/*
            Surfaced, never dropped. A patient whose room is not on this sheet is
            exactly the one somebody needs to notice — either the record is
            wrong or the sheet has changed, and both want a human.
          */}
          <ul className="space-y-0.5">
            {strays.map((patient) => (
              <li key={patient.id}>
                <Link
                  to={`/p/${patient.id}/${today}`}
                  className="text-[11px] text-fg hover:underline"
                >
                  {patient.room ? `Kamar ${patient.room} — ` : ''}
                  {denahLine(patient, showInitialsOnly)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Room({
  placed,
  slot,
  today,
  showInitialsOnly,
}: {
  placed: PlacedRoom | undefined;
  slot: DenahRoomSlot;
  today: ClinicalDate;
  showInitialsOnly: boolean;
}): JSX.Element {
  const beds = placed?.beds ?? Array.from<Patient | null>({ length: slot.beds }).fill(null);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <p className="border-b border-border px-2 py-1 text-center text-[11px] font-bold">
        KAMAR {slot.room}
        {slot.subtitle ? (
          <span className="block font-semibold text-fg-muted">{slot.subtitle}</span>
        ) : null}
      </p>

      <ol className="space-y-0.5 p-2">
        {beds.map((patient, index) => (
          <li key={`${slot.room}-${String(index)}`} className="flex gap-1.5">
            <span className="w-3 shrink-0 text-[11px] text-fg-faint">{index + 1}.</span>
            {patient ? (
              <Link
                to={`/p/${patient.id}/${today}`}
                className="min-w-0 flex-1 truncate text-[11px] leading-snug text-fg hover:underline"
                title={denahLine(patient, false)}
              >
                {denahLine(patient, showInitialsOnly)}
              </Link>
            ) : (
              /*
                An empty bed is drawn empty rather than omitted. An omitted bed
                is indistinguishable from a bed that does not exist, and on a
                floor plan that difference is the whole point.
              */
              <span className="flex-1 text-[11px] text-fg-faint">&nbsp;</span>
            )}
          </li>
        ))}

        {placed?.extra.map((patient) => (
          <li key={patient.id} className="flex gap-1.5">
            {/*
              In this room but not in a numbered slot — no bed recorded, or a
              bed number the sheet does not have.
            */}
            <span className="w-3 shrink-0 text-[11px] text-[var(--warn-strong)]">?</span>
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
  );
}
