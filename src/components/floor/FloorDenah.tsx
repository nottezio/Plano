import type { CSSProperties, ReactNode } from 'react';

import { dpjpById } from '@/domain/dpjp';
import { planRooms, type DenahColumn, type DenahRoomSlot, type WardPlan } from '@/domain/denahPlan';
import { byRoute, dpjpTitle, isPediatri, LIST_DPJP_ORDER, PEDIATRI_DPJP_IDS } from '@/domain/floorList/build';
import type { FloorPatient } from '@/domain/floorList/report';
import { placeBeds } from '@/domain/floorList/beds';
import { planLayout } from '@/domain/floorList/layout';

/**
 * The List Maker denah (12.8): the floor plan with every bed, the DPJP tables
 * and the residents' split — the printed DENAH, made tappable. Tapping a
 * patient opens the full SOAP (`SoapFloat`).
 *
 * Colours as on the printed sheet: red = H-1, green = pulang hari ini, the
 * pediatri DPJP code in amber. Each also carries a word for screen readers.
 */

const FLAG_COLOR = { tomorrow: 'var(--note-red)', today: 'var(--note-green)' } as const;
const FLAG_LABEL = { tomorrow: 'H-1', today: 'pulang hari ini' } as const;

function PatientButton({
  patient,
  number,
  onOpen,
  showPlace = true,
}: {
  patient: FloorPatient;
  number?: number | undefined;
  onOpen: (patient: FloorPatient) => void;
  showPlace?: boolean;
}): JSX.Element {
  const code = patient.dpjpId ? (dpjpById(patient.dpjpId)?.initials ?? '') : '';
  const place = showPlace && patient.room ? `${patient.room}${patient.bed ? ` Bed ${patient.bed}` : ''}/` : '';
  const residents = [patient.junior, patient.chief].filter(Boolean).map((n) => `dr. ${n}`).join(' / ');
  const flag = patient.discharge;
  return (
    <button
      type="button"
      onClick={() => onOpen(patient)}
      className="block w-full rounded-md px-1 py-0.5 text-left text-[12px] leading-snug text-fg hover:bg-bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      style={flag ? { color: FLAG_COLOR[flag] } : undefined}
    >
      {number !== undefined ? `${number}. ` : ''}
      {place}
      {code ? (
        <span style={isPediatri(patient.dpjpId) ? { color: 'var(--note-amber)' } : undefined}>{code}/</span>
      ) : null}
      {patient.identity}
      {patient.btkv ? <strong> (KJS BTKV)</strong> : null}
      {residents ? <strong className="text-fg"> - {residents}</strong> : null}
      {flag ? <span className="sr-only"> ({FLAG_LABEL[flag]})</span> : null}
    </button>
  );
}

function RoomBox({
  slot,
  patients,
  onOpen,
}: {
  slot: DenahRoomSlot;
  patients: FloorPatient[];
  onOpen: (patient: FloorPatient) => void;
}): JSX.Element {
  const { beds, loose } = placeBeds(slot, patients);
  return (
    <div className="rounded-lg border border-border bg-surface p-2">
      <p className="text-center text-[11px] font-bold uppercase tracking-wide">
        Kamar {slot.room}
        {slot.subtitle ? <span className="block font-semibold normal-case">{slot.subtitle}</span> : null}
      </p>
      <ol className="mt-1 space-y-0.5">
        {beds.map((patient, i) => (
          <li key={i} className="min-h-5 text-[12px] text-fg-faint">
            {patient ? (
              <PatientButton patient={patient} number={slot.beds > 1 ? i + 1 : undefined} onOpen={onOpen} showPlace={false} />
            ) : slot.beds > 1 ? (
              <span className="px-1">{i + 1}.</span>
            ) : null}
          </li>
        ))}
        {loose.map((patient) => (
          <li key={patient.key}>
            <PatientButton patient={patient} onOpen={onOpen} showPlace={false} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-faint">{title}</h3>
      {children}
    </section>
  );
}

export function FloorDenah({
  plan,
  ward,
  patients,
  onOpen,
}: {
  plan: WardPlan | null;
  ward: string;
  patients: readonly FloorPatient[];
  onOpen: (patient: FloorPatient) => void;
}): JSX.Element {
  const sorted = [...patients].sort(byRoute(ward));
  const rooms = plan ? planRooms(plan) : [];
  const known = new Set(rooms.map((slot) => slot.room));
  const inRoom = (room: string): FloorPatient[] => sorted.filter((p) => p.room === room);
  const strays = sorted.filter((p) => !known.has(p.room));

  const column = (blocks: DenahColumn[], key: string): JSX.Element => (
    <div key={key} className="flex min-w-0 flex-col gap-2">
      {blocks.map((block, index) =>
        block.landmark ? (
          <div
            key={`${key}-${index}`}
            className="flex min-h-[96px] flex-1 items-center justify-center rounded-lg bg-[var(--warn-strong)] p-2 text-center text-[11px] font-bold uppercase leading-tight tracking-wide text-white"
          >
            {block.landmark}
            <br />
            {ward}
          </div>
        ) : (
          <div key={`${key}-${index}`} className="flex flex-col gap-2">
            {(block.rooms ?? []).map((slot) => (
              <RoomBox key={slot.room} slot={slot} patients={inRoom(slot.room)} onOpen={onOpen} />
            ))}
          </div>
        ),
      )}
    </div>
  );

  // DPJP tables: the floor's order, then anyone else with a patient, then pediatri.
  const extra = [...new Set(sorted.map((p) => p.dpjpId).filter((id): id is string => !!id))].filter(
    (id) => !(LIST_DPJP_ORDER as readonly string[]).includes(id) && !isPediatri(id),
  );
  const order = [...LIST_DPJP_ORDER, ...extra, ...PEDIATRI_DPJP_IDS];

  // Residents: chief counts, then one block per junior.
  const chiefs = new Map<string, number>();
  const juniors = new Map<string, FloorPatient[]>();
  for (const p of sorted) {
    if (p.chief) chiefs.set(p.chief, (chiefs.get(p.chief) ?? 0) + 1);
    const key = p.junior || '(belum diisi)';
    juniors.set(key, [...(juniors.get(key) ?? []), p]);
  }

  return (
    <div className="space-y-6">
      {plan ? (
        <Section title={`Denah ${ward}`}>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {plan.header.map((slot) => (
              <RoomBox key={slot.room} slot={slot} patients={inRoom(slot.room)} onOpen={onOpen} />
            ))}
          </div>
          {/* Phone: the columns stacked. */}
          <div className="grid grid-cols-1 gap-2 md:hidden">
            {column(plan.columns[0], 'left')}
            {column(plan.columns[1], 'centre')}
            {column(plan.columns[2], 'right')}
          </div>
          {/*
            Tablet and up: one grid, left room i level with right room i
            (12.11, Avi: "not symmetrical, see the left rooms"). Same rows as
            the Word denah (`planLayout`).
          */}
          {(() => {
            const layout = planLayout(plan);
            const place = (row: number, span: number, column: number): CSSProperties => ({
              gridRow: `${row + 1} / span ${span}`,
              gridColumn: String(column),
            });
            return (
              <div
                className="hidden gap-2 md:grid md:grid-cols-[1fr_0.7fr_1fr]"
                style={{ gridTemplateRows: `repeat(${layout.rows}, minmax(3.5rem, auto))` }}
              >
                {layout.left.map((cell) => (
                  <div key={cell.slot.room} style={place(cell.row, cell.span, 1)} className="flex [&>*]:flex-1">
                    <RoomBox slot={cell.slot} patients={inRoom(cell.slot.room)} onOpen={onOpen} />
                  </div>
                ))}
                {layout.landmark ? (
                  <div
                    style={place(layout.landmark.row, layout.landmark.span, 2)}
                    className="flex items-center justify-center rounded-lg bg-[var(--warn-strong)] p-2 text-center text-[11px] font-bold uppercase leading-tight tracking-wide text-white"
                  >
                    {layout.landmark.label}
                    <br />
                    {ward}
                  </div>
                ) : null}
                {layout.centre.map((cell) => (
                  <div key={cell.slot.room} style={place(cell.row, cell.span, 2)} className="flex [&>*]:flex-1">
                    <RoomBox slot={cell.slot} patients={inRoom(cell.slot.room)} onOpen={onOpen} />
                  </div>
                ))}
                {layout.right.map((cell) => (
                  <div key={cell.slot.room} style={place(cell.row, cell.span, 3)} className="flex [&>*]:flex-1">
                    <RoomBox slot={cell.slot} patients={inRoom(cell.slot.room)} onOpen={onOpen} />
                  </div>
                ))}
              </div>
            );
          })()}
        </Section>
      ) : null}

      {strays.length > 0 ? (
        <Section title={plan ? 'Di luar denah' : `Pasien ${ward}`}>
          <div className="rounded-lg border border-border bg-surface p-2">
            {strays.map((p) => (
              <PatientButton key={p.key} patient={p} onOpen={onOpen} />
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Per DPJP">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {order.map((id) => {
            const own = sorted.filter((p) => p.dpjpId === id);
            const kjs = sorted.filter((p) => p.kjsDpjpIds.includes(id));
            return (
              <div key={id} className="rounded-lg border border-border bg-surface">
                <p className="border-b border-border px-2 py-1 text-center text-[12px] font-bold">{dpjpTitle(id)}</p>
                <div className="min-h-10 p-1">
                  {own.map((p, i) => (
                    <PatientButton key={p.key} patient={p} number={i + 1} onOpen={onOpen} />
                  ))}
                  {kjs.length > 0 ? (
                    <>
                      <p className="px-1 pt-1 text-[11px] font-semibold text-fg-muted">KJS:</p>
                      {kjs.map((p, i) => (
                        <PatientButton key={p.key} patient={p} number={i + 1} onOpen={onOpen} />
                      ))}
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Residen">
        {chiefs.size > 0 ? (
          <p className="text-[12px]">
            {[...chiefs].map(([name, n]) => `dr. ${name} ${n}`).join(' · ')}
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[...juniors].map(([name, list]) => (
            <div key={name} className="rounded-lg border border-border bg-surface p-2">
              <p className="text-[12px] font-bold">{name}</p>
              {list.map((p) => (
                <PatientButton key={p.key} patient={p} onOpen={onOpen} />
              ))}
            </div>
          ))}
        </div>
      </Section>

      <p className="text-[11px] text-fg-muted">
        <span style={{ color: 'var(--note-red)' }}>Merah</span> H-1 ·{' '}
        <span style={{ color: 'var(--note-green)' }}>Hijau</span> Pulang hari ini · Ketuk pasien untuk SOAP lengkap.
      </p>
    </div>
  );
}
