import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { dpjpById } from '@/domain/dpjp';
import { planRooms, type DenahRoomSlot, type WardPlan } from '@/domain/denahPlan';
import { byRoute, dpjpTitle, isPediatri, LIST_DPJP_ORDER, PEDIATRI_DPJP_IDS } from '@/domain/floorList/build';
import { markCss, type FloorMark } from '@/domain/floorList/marks';
import type { FloorPatient } from '@/domain/floorList/report';
import { matchesSearch } from '@/domain/floorList/search';
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

/** While searching (13.7): a match is highlighted, the rest dimmed — the plan keeps every bed in place. */
type Found = 'hit' | 'dim' | undefined;

function PatientButton({
  patient,
  number,
  onOpen,
  showPlace = true,
  found,
}: {
  patient: FloorPatient;
  number?: number | undefined;
  onOpen: (patient: FloorPatient) => void;
  showPlace?: boolean;
  found?: Found;
}): JSX.Element {
  const code = patient.dpjpId ? (dpjpById(patient.dpjpId)?.initials ?? '') : '';
  const place = showPlace && patient.room ? `${patient.room}${patient.bed ? ` Bed ${patient.bed}` : ''}/` : '';
  const residents = [patient.junior, patient.chief].filter(Boolean).map((n) => `dr. ${n}`).join(' / ');
  const flag = patient.discharge;
  // Red/green first; else the floor's own mark (13.7).
  const colour = flag ? FLAG_COLOR[flag] : patient.mark ? markCss(patient.mark.color) : undefined;
  return (
    <button
      type="button"
      onClick={() => onOpen(patient)}
      className={`block w-full rounded-md px-1 py-0.5 text-left text-[12px] leading-snug text-fg hover:bg-bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
        found === 'dim' ? 'opacity-30' : found === 'hit' ? 'outline outline-2 outline-accent' : ''
      }`}
      style={colour ? { color: colour } : undefined}
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
      {!flag && patient.mark ? <span className="font-semibold"> [{patient.mark.label}]</span> : null}
    </button>
  );
}

function RoomBox({
  slot,
  patients,
  onOpen,
  find,
}: {
  slot: DenahRoomSlot;
  patients: FloorPatient[];
  onOpen: (patient: FloorPatient) => void;
  find: (patient: FloorPatient) => Found;
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
              <PatientButton patient={patient} number={slot.beds > 1 ? i + 1 : undefined} onOpen={onOpen} showPlace={false} found={find(patient)} />
            ) : slot.beds > 1 ? (
              <span className="px-1">{i + 1}.</span>
            ) : null}
          </li>
        ))}
        {loose.map((patient) => (
          <li key={patient.key}>
            <PatientButton patient={patient} onOpen={onOpen} showPlace={false} found={find(patient)} />
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

/** The width the plan is drawn at: the desk layout, room text at full size. */
const DESK_WIDTH = 880;
const ZOOM_KEY = 'plano.listmaker.denahZoom';

/**
 * The plan at its desk width, everywhere (12.12). Narrower than that (a
 * phone), it is scaled down to fit — the whole floor at a glance, rooms where
 * they are on the ward — and "Perbesar" shows it at full size to scroll
 * sideways. Tapping a patient still opens the SOAP, which is full size.
 * The choice is remembered on this device.
 */
function DenahCanvas({ children }: { children: ReactNode }): JSX.Element {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DESK_WIDTH);
  const [height, setHeight] = useState(0);
  const [zoomed, setZoomed] = useState(() => {
    try {
      return localStorage.getItem(ZOOM_KEY) === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const box = outer.current;
    const content = inner.current;
    if (!box || !content) return undefined;
    const measure = (): void => {
      setWidth(box.clientWidth);
      setHeight(content.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);
  const narrow = width < DESK_WIDTH;
  const scale = narrow && !zoomed ? width / DESK_WIDTH : 1;
  const toggle = (): void => {
    setZoomed((now) => {
      try {
        localStorage.setItem(ZOOM_KEY, now ? '0' : '1');
      } catch {
        // Not remembered in a private window; still works.
      }
      return !now;
    });
  };
  return (
    <div>
      {narrow ? (
        <div className="mb-1 flex justify-end">
          <button type="button" onClick={toggle} className="min-h-tap rounded-lg border border-border px-3 text-xs font-medium">
            {zoomed ? 'Muat di layar' : 'Perbesar'}
          </button>
        </div>
      ) : null}
      {/*
        `relative`: the scroller must be the containing block of the patients'
        sr-only colour labels (absolutely positioned). Without it they were
        laid out against #main, at their place in the 880 px plan, and #main
        itself scrolled sideways on a phone (13.6, Avi's screenshots) — the
        same pattern as #24, one level down. `overscroll-x-contain` keeps a
        sideways swipe at the plan's edge from moving the page.
      */}
      <div
        ref={outer}
        className={`relative ${narrow && zoomed ? 'overflow-x-auto overscroll-x-contain' : 'overflow-hidden'}`}
        style={narrow && !zoomed ? { height: height * scale } : undefined}
      >
        <div
          ref={inner}
          style={{
            width: narrow ? DESK_WIDTH : undefined,
            transform: scale < 1 ? `scale(${scale})` : undefined,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function FloorDenah({
  plan,
  ward,
  patients,
  onOpen,
  words = [],
  marks = [],
}: {
  plan: WardPlan | null;
  ward: string;
  patients: readonly FloorPatient[];
  onOpen: (patient: FloorPatient) => void;
  /** The page's search (13.7). */
  words?: readonly string[];
  /** The floor's own colours, for the legend. */
  marks?: readonly FloorMark[];
}): JSX.Element {
  const sorted = [...patients].sort(byRoute(ward));
  const searching = words.length > 0;
  const hits = searching ? sorted.filter((p) => matchesSearch(p, words)) : [];
  const hitKeys = new Set(hits.map((p) => p.key));
  const find = (p: FloorPatient): Found => (!searching ? undefined : hitKeys.has(p.key) ? 'hit' : 'dim');
  // The lists below the plan show the matches only; the plan dims the rest.
  const shown = searching ? hits : sorted;
  const rooms = plan ? planRooms(plan) : [];
  const known = new Set(rooms.map((slot) => slot.room));
  const inRoom = (room: string): FloorPatient[] => sorted.filter((p) => p.room === room);
  const strays = sorted.filter((p) => !known.has(p.room));

  // DPJP tables: the floor's order, then anyone else with a patient, then pediatri.
  const extra = [...new Set(sorted.map((p) => p.dpjpId).filter((id): id is string => !!id))].filter(
    (id) => !(LIST_DPJP_ORDER as readonly string[]).includes(id) && !isPediatri(id),
  );
  const order = [...LIST_DPJP_ORDER, ...extra, ...PEDIATRI_DPJP_IDS];

  // Residents: chief counts, then one block per junior.
  const chiefs = new Map<string, number>();
  const juniors = new Map<string, FloorPatient[]>();
  for (const p of shown) {
    if (p.chief) chiefs.set(p.chief, (chiefs.get(p.chief) ?? 0) + 1);
    const key = p.junior || '(belum diisi)';
    juniors.set(key, [...(juniors.get(key) ?? []), p]);
  }

  return (
    <div className="space-y-6">
      {searching ? (
        <Section title={`Hasil cari (${hits.length})`}>
          {hits.length === 0 ? (
            <p className="text-[12px] text-fg-muted">Tidak ada pasien yang cocok.</p>
          ) : (
            <div className="rounded-lg border border-border bg-surface p-2">
              {hits.map((p) => (
                <PatientButton key={p.key} patient={p} onOpen={onOpen} />
              ))}
            </div>
          )}
        </Section>
      ) : null}
      {plan ? (
        <Section title={`Denah ${ward}`}>
          <DenahCanvas>
            <div className="grid grid-cols-2 gap-2">
              {plan.header.map((slot) => (
                <RoomBox key={slot.room} slot={slot} patients={inRoom(slot.room)} onOpen={onOpen} find={find} />
              ))}
            </div>
            {/*
              One grid on every screen (12.12, Avi: the phone showed a stacked
              list, not a denah): left room i level with right room i, the
              same rows as the Word denah (`planLayout`). On a phone the whole
              plan is drawn at its desk width and scaled to fit (DenahCanvas).
            */}
            {(() => {
              const layout = planLayout(plan);
              const place = (row: number, span: number, column: number): CSSProperties => ({
                gridRow: `${row + 1} / span ${span}`,
                gridColumn: String(column),
              });
              return (
                <div
                  className="mt-2 grid grid-cols-[1fr_0.7fr_1fr] gap-2"
                  style={{ gridTemplateRows: `repeat(${layout.rows}, minmax(3.5rem, auto))` }}
                >
                  {layout.left.map((cell) => (
                    <div key={cell.slot.room} style={place(cell.row, cell.span, 1)} className="flex [&>*]:flex-1">
                      <RoomBox slot={cell.slot} patients={inRoom(cell.slot.room)} onOpen={onOpen} find={find} />
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
                      <RoomBox slot={cell.slot} patients={inRoom(cell.slot.room)} onOpen={onOpen} find={find} />
                    </div>
                  ))}
                  {layout.right.map((cell) => (
                    <div key={cell.slot.room} style={place(cell.row, cell.span, 3)} className="flex [&>*]:flex-1">
                      <RoomBox slot={cell.slot} patients={inRoom(cell.slot.room)} onOpen={onOpen} find={find} />
                    </div>
                  ))}
                </div>
              );
            })()}
          </DenahCanvas>
        </Section>
      ) : null}

      {strays.length > 0 ? (
        <Section title={plan ? 'Di luar denah' : `Pasien ${ward}`}>
          <div className="rounded-lg border border-border bg-surface p-2">
            {strays.map((p) => (
              <PatientButton key={p.key} patient={p} onOpen={onOpen} found={find(p)} />
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Per DPJP">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {order.map((id) => {
            const own = shown.filter((p) => p.dpjpId === id);
            const kjs = shown.filter((p) => p.kjsDpjpIds.includes(id));
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
        <span style={{ color: 'var(--note-green)' }}>Hijau</span> Pulang hari ini
        {marks.map((m) => (
          <span key={m.id}>
            {' · '}
            <span style={{ color: markCss(m.color) }}>{m.label}</span>
          </span>
        ))}{' '}
        · Ketuk pasien untuk SOAP lengkap.
      </p>
    </div>
  );
}
