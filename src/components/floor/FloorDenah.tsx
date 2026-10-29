import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { planRooms, type DenahRoomSlot, type WardPlan } from '@/domain/denahPlan';
import { byRoute, dpjpCodeOf, dpjpTitle, isPediatri, LIST_DPJP_ORDER, PEDIATRI_DPJP_IDS } from '@/domain/floorList/build';
import { isAmberDpjp } from '@/domain/floorList/printSettings';
import { handoverLine } from '@/domain/floorList/docx';
import { markCss, type FloorMark } from '@/domain/floorList/marks';
import type { FloorPatient } from '@/domain/floorList/report';
import { holderBoxes, residentGroups } from '@/domain/floorList/residents';
import { setPrintSettings, usePrintSettings } from '@/hooks/usePrintSettings';
import { matchesSearch } from '@/domain/floorList/search';
import { placeBeds } from '@/domain/floorList/beds';
import { SoapBadge } from './SoapBadge';
import { planLayout } from '@/domain/floorList/layout';
import {
  clampZoom,
  pinchStart,
  pinchStep,
  readStoredZoom,
  zoomAbout,
  type PinchStart,
} from '@/domain/floorList/pinch';

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

/**
 * Mark the patients whose H-1 is only proposed (usul), on the screen denah
 * (28 Oct 2026, Avi: "a toggle in denah view that shows who have a usul state").
 * A context rather than a prop: every line of the plan, the DPJP boxes and the
 * residents' boxes is a `PatientButton`. Off by default; remembered on this device.
 */
const ShowUsul = createContext(false);
const USUL_KEY = 'plano.denah.usul';

function readUsulToggle(): boolean {
  try {
    return localStorage.getItem(USUL_KEY) === '1';
  } catch {
    return false;
  }
}

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
  const code = dpjpCodeOf(patient);
  const place = showPlace && patient.room ? `${patient.room}${patient.bed ? ` Bed ${patient.bed}` : ''}/` : '';
  const residents = [patient.junior, patient.chief].filter(Boolean).map((n) => `dr. ${n}`).join(' / ');
  const flag = patient.discharge;
  const usul = useContext(ShowUsul) && patient.usul === true;
  const print = usePrintSettings();
  // Red/green colour the line; a floor tag only colours itself (13.10).
  const colour = flag ? FLAG_COLOR[flag] : undefined;
  return (
    <button
      type="button"
      onClick={() => onOpen(patient)}
      className={`block w-full rounded-md px-1 py-0.5 text-left text-[12px] leading-snug text-fg hover:bg-bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
        usul ? 'bg-[var(--warn-soft)]' : ''
      } ${found === 'dim' ? 'opacity-30' : found === 'hit' ? 'outline outline-2 outline-accent' : ''}`}
      style={colour ? { color: colour } : undefined}
    >
      {number !== undefined ? `${number}. ` : ''}
      {place}
      {code ? (
        <span style={isAmberDpjp(patient.dpjpId, print.denah) ? { color: 'var(--note-amber)' } : undefined}>{code}/</span>
      ) : null}
      {patient.identity}
      {patient.btkv ? <strong> (KJS BTKV)</strong> : null}
      {residents ? <strong className="text-fg"> - {residents}</strong> : null}
      {flag ? <span className="sr-only"> ({FLAG_LABEL[flag]})</span> : null}
      {usul ? <strong style={{ color: 'var(--warn-strong)' }}> [usul]</strong> : null}
      <Tags patient={patient} />
      <SoapBadge patient={patient} />
    </button>
  );
}

/** The floor's tags after a line, each in its own colour (13.10). */
function Tags({ patient }: { patient: FloorPatient }): JSX.Element | null {
  if (!patient.tags?.length) return null;
  return (
    <>
      {patient.tags.map((tag) => (
        <strong key={tag.label} style={{ color: markCss(tag.color) }}>
          {' '}
          [{tag.label}]
        </strong>
      ))}
    </>
  );
}

/**
 * A KJS patient whose full line is in its own DPJP's box (13.10, Avi: the
 * same patient in two boxes): a short grey reference, still tappable.
 */
function KjsReference({ patient, number, onOpen }: { patient: FloorPatient; number: number; onOpen: (patient: FloorPatient) => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onOpen(patient)}
      className="block w-full rounded-md px-1 py-0.5 text-left text-[12px] leading-snug text-fg-muted hover:bg-bg-subtle"
    >
      {number}. {patient.room}
      {patient.bed ? ` Bed ${patient.bed}` : ''}/{patient.name} → {dpjpCodeOf(patient)}
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
      <p className="text-center text-xs font-bold uppercase tracking-wide">
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
 * phone), it starts scaled down to fit — the whole floor at a glance, rooms
 * where they are on the ward.
 *
 * Pinch to zoom (2026-10-14, Avi): two fingers on the plan zoom the PLAN
 * only, from fit up to twice full size, keeping the spot under the fingers
 * in place; one finger scrolls as before. The plan box sets `touch-action:
 * pan-x pan-y`, so the browser no longer zooms the whole page for a pinch
 * that starts on it. "Perbesar" / "Muat di layar" stay as one-tap shortcuts
 * (full size / fit). Tapping a patient still opens the SOAP. The zoom is
 * remembered on this device.
 */
function DenahCanvas({ children }: { children: ReactNode }): JSX.Element {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DESK_WIDTH);
  const [height, setHeight] = useState(0);
  /** null = fit to the screen (follows its width); a number = that scale. */
  const [zoom, setZoom] = useState<number | null>(() => {
    try {
      return readStoredZoom(localStorage.getItem(ZOOM_KEY));
    } catch {
      return null;
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
  const fit = narrow ? width / DESK_WIDTH : 1;
  const scale = narrow ? clampZoom(zoom ?? fit, fit) : 1;
  const atFit = scale <= fit + 0.001;

  const remember = (next: number | null): void => {
    try {
      localStorage.setItem(ZOOM_KEY, next === null ? '0' : String(Math.round(next * 100) / 100));
    } catch {
      // Not remembered in a private window; still works.
    }
  };

  // The scroll to apply once the new scale is laid out (see pinchStep).
  const pending = useRef<{ scrollLeft: number; scrollBy: number } | null>(null);
  useLayoutEffect(() => {
    const box = outer.current;
    const move = pending.current;
    if (!box || !move) return;
    pending.current = null;
    box.scrollLeft = move.scrollLeft;
    if (Math.abs(move.scrollBy) >= 1) scrollParentOf(box).scrollBy(0, move.scrollBy);
  }, [scale]);

  /**
   * Zoom about a screen point (the double-tap), so the spot you tapped stays
   * under your finger. A zoom that left the scroll alone grew the plan from
   * its top-left corner and moved the room you were looking at away.
   */
  const zoomTo = (target: number, point: { x: number; y: number }): void => {
    const box = outer.current;
    if (!box) return;
    const next = clampZoom(target, fit);
    if (Math.abs(next - scale) < 0.001) return;
    const rect = box.getBoundingClientRect();
    pending.current = zoomAbout(scale, next, point, { left: rect.left, top: rect.top, scrollLeft: box.scrollLeft });
    const stored = next <= fit * 1.02 ? null : next;
    setZoom(stored);
    remember(stored);
  };

  // Two-finger pinch. Listeners are attached by hand: React's touch handlers
  // are passive, and the move must be able to cancel the page's own zoom.
  const live = useRef({ fit, scale });
  live.current = { fit, scale };
  useEffect(() => {
    const box = outer.current;
    if (!box || !narrow) return undefined;
    let start: PinchStart | null = null;
    let last: number | null = null;
    const point = (touch: Touch): { x: number; y: number } => ({ x: touch.clientX, y: touch.clientY });
    const onStart = (event: TouchEvent): void => {
      if (event.touches.length !== 2) return;
      const rect = box.getBoundingClientRect();
      start = pinchStart(
        point(event.touches[0]!),
        point(event.touches[1]!),
        { left: rect.left, top: rect.top, scrollLeft: box.scrollLeft },
        live.current.scale,
      );
    };
    const onMove = (event: TouchEvent): void => {
      if (!start || event.touches.length !== 2) return;
      event.preventDefault();
      const rect = box.getBoundingClientRect();
      const step = pinchStep(start, point(event.touches[0]!), point(event.touches[1]!), rect, live.current.fit);
      last = step.scale;
      if (step.scale === live.current.scale) {
        // At a limit (fit or 2×) the scale does not change, so no layout
        // effect runs: the two-finger pan is applied here instead.
        box.scrollLeft = step.scrollLeft;
        if (Math.abs(step.scrollBy) >= 1) scrollParentOf(box).scrollBy(0, step.scrollBy);
        return;
      }
      pending.current = { scrollLeft: step.scrollLeft, scrollBy: step.scrollBy };
      setZoom(step.scale);
    };
    const onEnd = (event: TouchEvent): void => {
      if (!start || event.touches.length >= 2) return;
      start = null;
      if (last !== null) {
        // Back at (or very near) fit: store "fit", so it follows the screen.
        const next = last <= live.current.fit * 1.02 ? null : last;
        if (next === null) setZoom(null);
        remember(next);
      }
      last = null;
    };
    // Safari's own pinch events: cancelled so the page never zooms from here.
    const noGesture = (event: Event): void => event.preventDefault();
    box.addEventListener('touchstart', onStart, { passive: true });
    box.addEventListener('touchmove', onMove, { passive: false });
    box.addEventListener('touchend', onEnd);
    box.addEventListener('touchcancel', onEnd);
    box.addEventListener('gesturestart', noGesture);
    box.addEventListener('gesturechange', noGesture);
    return () => {
      box.removeEventListener('touchstart', onStart);
      box.removeEventListener('touchmove', onMove);
      box.removeEventListener('touchend', onEnd);
      box.removeEventListener('touchcancel', onEnd);
      box.removeEventListener('gesturestart', noGesture);
      box.removeEventListener('gesturechange', noGesture);
    };
  }, [narrow]);

  // Double-tap on empty plan: fit <-> readable (full desk size), about the tap.
  // Not on a button: a patient's first tap already opened the SOAP.
  const toggleAt = useRef((_point: { x: number; y: number }): void => undefined);
  toggleAt.current = (point) => zoomTo(atFit ? 1 : fit, point);
  useEffect(() => {
    const box = outer.current;
    if (!box || !narrow) return undefined;
    let down: { x: number; y: number; t: number } | null = null;
    let last: { x: number; y: number; t: number } | null = null;
    const onDown = (event: TouchEvent): void => {
      const touch = event.touches[0];
      down = touch && event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY, t: Date.now() } : null;
    };
    const onUp = (event: TouchEvent): void => {
      const touch = event.changedTouches[0];
      const from = down;
      if (!touch || !from || event.touches.length > 0) return;
      down = null;
      const now = Date.now();
      const isTap = Math.hypot(touch.clientX - from.x, touch.clientY - from.y) < 10 && now - from.t < 300;
      if (!isTap || (event.target as Element).closest('button, a, input, textarea, label')) {
        last = null;
        return;
      }
      if (last && now - last.t < 350 && Math.hypot(touch.clientX - last.x, touch.clientY - last.y) < 30) {
        last = null;
        toggleAt.current({ x: touch.clientX, y: touch.clientY });
      } else {
        last = { x: touch.clientX, y: touch.clientY, t: now };
      }
    };
    box.addEventListener('touchstart', onDown, { passive: true });
    box.addEventListener('touchend', onUp, { passive: true });
    return () => {
      box.removeEventListener('touchstart', onDown);
      box.removeEventListener('touchend', onUp);
    };
  }, [narrow]);

  return (
    <div>
      {narrow ? (
        <p className="mb-1 text-right text-xs text-fg-faint">Cubit dua jari, atau ketuk dua kali di area kosong</p>
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
        className={`relative ${narrow && !atFit ? 'overflow-x-auto overscroll-x-contain' : 'overflow-hidden'}`}
        style={narrow ? { height: height * scale, touchAction: 'pan-x pan-y' } : undefined}
      >
        <div style={narrow ? { width: DESK_WIDTH * scale, height: height * scale } : undefined}>
          <div
            ref={inner}
            style={{
              width: narrow ? DESK_WIDTH : undefined,
              transform: narrow && scale !== 1 ? `scale(${scale})` : undefined,
              transformOrigin: 'top left',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The element that scrolls the page vertically around `node` (#main in the app). */
function scrollParentOf(node: HTMLElement): Element {
  for (let at = node.parentElement; at; at = at.parentElement) {
    const { overflowY } = getComputedStyle(at);
    if ((overflowY === 'auto' || overflowY === 'scroll') && at.scrollHeight > at.clientHeight) return at;
  }
  return document.scrollingElement ?? document.documentElement;
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

  // Residents: chief counts, one block per junior, then division patients (13.9).
  const groups = residentGroups(shown);
  const { chiefs } = groups;
  const boxes = holderBoxes(groups);
  // One setting with the print setup (20 Oct 2026): the PDF and Word follow the screen.
  const print = usePrintSettings();
  const holderView = print.denah.residentsList ? 'list' : 'grid';
  const setHolderView = (next: 'grid' | 'list'): void =>
    setPrintSettings({ ...print, denah: { ...print.denah, residentsList: next === 'list' } });

  const [showUsul, setShowUsul] = useState(readUsulToggle);
  const toggleUsul = (): void => {
    const next = !showUsul;
    setShowUsul(next);
    try {
      localStorage.setItem(USUL_KEY, next ? '1' : '0');
    } catch {
      // Lasts for this visit.
    }
  };
  const usulPatients = sorted.filter((p) => p.usul === true);

  return (
    <ShowUsul.Provider value={showUsul}>
    <div className="space-y-6">
      <div className="space-y-2">
        <button
          type="button"
          aria-pressed={showUsul}
          onClick={toggleUsul}
          disabled={usulPatients.length === 0 && !showUsul}
          title="Tandai pasien yang H-1-nya baru usul (menunggu konfirmasi DPJP)"
          className={`flex min-h-tap items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-50 [@media(pointer:fine)]:min-h-9 ${
            showUsul ? 'border-[var(--warn-strong)] bg-[var(--warn-soft)] text-fg' : 'border-border text-fg-muted hover:text-fg'
          }`}
        >
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: 'var(--warn-strong)' }} />
          Tampilkan usul H-1
          <span className="tabular-nums text-fg-faint">{usulPatients.length}</span>
        </button>
        {showUsul && usulPatients.length > 0 ? (
          <p className="text-xs text-fg-muted">
            <span className="font-semibold text-fg">Usul H-1:</span>{' '}
            {usulPatients.map((p, i) => (
              <span key={p.key}>
                {i > 0 ? ' · ' : ''}
                <button type="button" onClick={() => onOpen(p)} className="hover:underline">
                  {p.room}
                  {p.bed ? `/${p.bed}` : ''} {p.name}
                </button>
              </span>
            ))}
          </p>
        ) : null}
      </div>
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
                      className="flex items-center justify-center rounded-lg bg-[var(--warn-strong)] p-2 text-center text-xs font-bold uppercase leading-tight tracking-wide text-white"
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
                      <p className="px-1 pt-1 text-xs font-semibold text-fg-muted">KJS:</p>
                      {kjs.map((p, i) =>
                        p.dpjpId ? (
                          <KjsReference key={p.key} patient={p} number={i + 1} onOpen={onOpen} />
                        ) : (
                          <PatientButton key={p.key} patient={p} number={i + 1} onOpen={onOpen} />
                        ),
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Residen">
        <div className="flex flex-wrap items-center gap-2">
          {chiefs.length > 0 ? (
            <p className="min-w-0 flex-1 text-[12px]">{chiefs.map(([name, n]) => `dr. ${name} ${n}`).join(' · ')}</p>
          ) : (
            <span className="flex-1" />
          )}
          {/* Boxes or one vertical list (19 Oct 2026, Avi: "like the previous one"). */}
          <div role="group" aria-label="Tampilan residen" className="flex rounded-lg border border-border p-0.5 text-[12px]">
            {(
              [
                ['grid', 'Kotak'],
                ['list', 'Daftar'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={holderView === value}
                onClick={() => setHolderView(value)}
                className={`min-h-tap rounded-md px-3 ${holderView === value ? 'bg-bg-subtle font-semibold text-fg' : 'text-fg-muted'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div
          className={
            holderView === 'grid'
              ? 'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3'
              : 'divide-y divide-border rounded-lg border border-border bg-surface'
          }
        >
          {boxes.map(({ name, list, division }) => (
            <div key={name} className={holderView === 'grid' ? 'rounded-lg border border-border bg-surface p-2' : 'p-2'}>
              <p className="text-[14px] font-bold">
                {name} <span className="text-[12px] font-normal text-fg-muted">({list.length}{division ? ', tidak di-FU' : ''})</span>
              </p>
              {list.map((p, i) => (
                <PatientButton key={p.key} patient={p} number={i + 1} onOpen={onOpen} />
              ))}
            </div>
          ))}
        </div>
        {/* The handover notes set on the patients (13.14), as on the Word residents page. */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(
            [
              ['Operkan ke Tmn Lain', shown.filter((p) => p.operkan), (p: FloorPatient) => p.operkan!],
              ['Ganti Chief', shown.filter((p) => p.gantiChief), (p: FloorPatient) => p.gantiChief!],
            ] as const
          ).map(([title, list, to]) => (
            <div key={title} className="rounded-lg border border-border bg-surface p-2">
              <p className="text-[14px] font-bold">{title}</p>
              {list.length === 0 ? <p className="text-[12px] text-fg-faint">— (isi di Atur pasien)</p> : null}
              {list.map((p, i) => (
                <button key={p.key} type="button" onClick={() => onOpen(p)} className="block w-full px-1 py-0.5 text-left text-[12px] hover:underline">
                  {handoverLine(p, to(p), i + 1)}
                </button>
              ))}
            </div>
          ))}
        </div>
      </Section>

      <p className="text-xs text-fg-muted">
        <span style={{ color: 'var(--note-red)' }}>Merah</span> H-1 ·{' '}
        <span style={{ color: 'var(--note-green)' }}>Hijau</span> Pulang hari ini
        {marks.map((m) => (
          <span key={m.id}>
            {' · '}
            <span style={{ color: markCss(m.color) }}>{m.label}</span>
          </span>
        ))}{' '}
        {showUsul ? (
          <>
            {' · '}
            <span style={{ color: 'var(--warn-strong)' }}>[usul]</span> Usul H-1 (belum disetujui)
          </>
        ) : null}{' '}
        · Ketuk pasien untuk SOAP lengkap.
      </p>
    </div>
    </ShowUsul.Provider>
  );
}
