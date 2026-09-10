import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import {
  DEFAULT_W,
  MIN_CARD_PX,
  ROW_STEP,
  applyGesture,
  columnsFor,
  placeAll,
  readLayouts,
  tidy,
  writeLayouts,
  type CardLayout,
  type CanvasLayouts,
} from '@/domain/board/canvasLayout';

/**
 * The free canvas: drag a card anywhere, set its width, cap its height.
 *
 * WHY THIS IS A SEPARATE COMPONENT FROM MasonryGrid RATHER THAN A MODE OF IT
 *
 * The two disagree about who owns position. Masonry measures every card and
 * decides where it goes; the canvas is told where every card goes and measures
 * nothing except what it must. Threading a flag through the grid would leave
 * one component holding both contracts, and the first bug in that arrangement
 * is a card whose position is computed by one half and overridden by the other.
 *
 * DESKTOP AND TABLET ONLY, DELIBERATELY
 *
 * The caller renders masonry below `lg`. A hand-arranged canvas needs room for
 * cards to sit beside each other, and on a 360 px phone there is room for
 * exactly one column — at which point "where you put it" degenerates into a
 * list, and a bad one, because the gaps arranged on a desktop survive as dead
 * space you scroll through.
 */
export function CanvasBoard({
  ids,
  items,
  enabled,
}: {
  /** Every card on the board, in board order. Drives auto-placement. */
  ids: readonly string[];
  /** One item per id, same order. Rendered inside a positioned wrapper. */
  items: readonly ReactNode[];
  /** False while another order is selected; the canvas then renders nothing. */
  enabled: boolean;
}): JSX.Element {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [stored, setStored] = useState<CanvasLayouts>(() => readLayouts());
  const [width, setWidth] = useState(0);

  /**
   * The canvas width, measured.
   *
   * Everything horizontal is a fraction of this, so it has to be a real
   * measurement rather than a breakpoint guess — the sidebar collapses, the
   * window resizes, and a fraction multiplied by the wrong width puts every
   * card in the wrong place at once.
   */
  useEffect(() => {
    const node = surfaceRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      setWidth(node.getBoundingClientRect().width);
    });
    observer.observe(node);
    setWidth(node.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, [enabled]);

  const canvasWidth = width || 1200;
  const columns = columnsFor(canvasWidth);
  const layouts = useMemo(() => placeAll(ids, stored, columns), [ids, stored, columns]);

  /**
   * The card under the finger, held apart from `stored`.
   *
   * Storage is written on RELEASE, not on move. A pointermove fires up to a
   * hundred times a second and `localStorage.setItem` is synchronous — writing
   * per frame would serialise the whole layout on the main thread at exactly
   * the moment the board must not stutter.
   *
   * One `live` slot rather than one per gesture type, because only one card
   * can be in hand at a time and three overlapping states would need rules
   * about which of them wins.
   */
  const [live, setLive] = useState<{ id: string; layout: CardLayout } | null>(null);

  /**
   * Natural (uncapped) height per card, recorded as it is measured.
   *
   * Needed to answer one question: has the user dragged the bottom edge back
   * past the end of the content? If so the cap is REMOVED rather than set to a
   * large number — an `hMax` of 900 on a card whose content is 400 tall
   * behaves identically to no cap until the note grows, and then silently
   * starts clipping something the user believed they had uncapped.
   */
  const naturalHeights = useRef(new Map<string, number>());
  const recordHeight = useCallback((id: string, value: number) => {
    naturalHeights.current.set(id, value);
  }, []);

  /**
   * Cards temporarily shown in full despite their cap. Not persisted.
   *
   * "Show me the rest of this one now" is not the same act as "this card
   * should be this tall", and persisting it would quietly undo a cap the user
   * set deliberately.
   */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const toggleExpanded = useCallback((id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  /**
   * The layout as it was before the last Rapikan, or null.
   *
   * Rapikan overwrites every position at once, and the positions it overwrites
   * are the only record of work done by hand — there is no other copy and no
   * way to reconstruct it. An action that destructive needs a way back that
   * does not depend on remembering where forty cards were.
   *
   * Held in memory, not storage: undo is for the ten seconds after the press,
   * and an "Urungkan" still sitting there tomorrow would offer to revert an
   * arrangement the user has since worked on.
   */
  const [undo, setUndo] = useState<CanvasLayouts | null>(null);

  const applyLayouts = useCallback((next: CanvasLayouts) => {
    setStored(next);
    writeLayouts(next);
  }, []);

  const commit = useCallback((id: string, layout: CardLayout) => {
    setStored((previous) => {
      const next: CanvasLayouts = { ...previous, [id]: layout };
      writeLayouts(next);
      return next;
    });
  }, []);

  /**
   * One gesture handler for all three grips.
   *
   * They differ only in which fields the pointer delta writes to. Written
   * separately, the duplicated parts — pointer capture, the window listeners,
   * `pointercancel`, committing on release — are exactly the parts where a bug
   * stays invisible until the board starts moving cards on its own.
   */
  const beginGesture = useCallback(
    (event: React.PointerEvent, id: string, mode: 'move' | 'width' | 'height') => {
      const surface = surfaceRef.current;
      if (!surface) return;

      const handle = event.currentTarget as HTMLElement;
      // Capture, so the gesture keeps reporting after the finger leaves the
      // grip — which happens immediately, since moving away is the point.
      handle.setPointerCapture(event.pointerId);

      const measured = surface.getBoundingClientRect().width || 1;
      const origin: CardLayout = layouts[id] ?? { x: 0, y: 0, w: DEFAULT_W, hMax: 0 };
      const natural = naturalHeights.current.get(id) ?? 0;
      const startX = event.clientX;
      const startY = event.clientY;
      let latest = origin;

      const onMove = (movement: PointerEvent): void => {
        // The arithmetic lives in the domain, where it is tested. This handler
        // owns the gesture; it does not own what a gesture means.
        latest = applyGesture(mode, origin, {
          dx: movement.clientX - startX,
          dy: movement.clientY - startY,
          canvasWidth: measured,
          natural,
        });

        setLive({ id, layout: latest });
      };

      const onUp = (): void => {
        setLive(null);
        commit(id, latest);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      // Without this the listeners survive a gesture the browser took over — a
      // scroll it reinterpreted, a call arriving — and the next tap anywhere
      // moves a card.
      window.addEventListener('pointercancel', onUp);
    },
    [layouts, commit],
  );

  /**
   * Canvas height, from the lowest card.
   *
   * Assumed from `ROW_STEP` — or from the card's own cap, where it has one,
   * which is exact — rather than measured per card. A measured version needs
   * every card reporting its height on every content change; the failure it
   * would prevent, a card hanging below the scrollable area, is covered by the
   * padding added here.
   */
  const height = useMemo(() => {
    const lowest = ids.reduce((max, id) => {
      const layout = layouts[id];
      if (!layout) return max;
      return Math.max(max, layout.y + (layout.hMax || ROW_STEP));
    }, 0);
    return lowest + 160;
  }, [ids, layouts]);

  if (!enabled) return <div ref={surfaceRef} className="hidden" />;

  return (
    <>
      {/*
        Rapikan lives here rather than in the board toolbar because the layout
        it rewrites lives here. Lifting the state up to put the button in a
        tidier place would mean two components able to write the same
        arrangement, which is how they end up disagreeing about it.
      */}
      <div className="flex items-center justify-end gap-2 px-4 pb-1 text-xs">
        {undo ? (
          <button
            type="button"
            onClick={() => {
              applyLayouts(undo);
              setUndo(null);
            }}
            className="min-h-tap rounded-lg border border-border px-3 font-medium text-accent"
          >
            Urungkan
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setUndo(layouts);
            applyLayouts(tidy(ids, layouts, columns));
          }}
          title="Rapatkan kartu, tanpa mengubah urutan yang sudah diatur"
          className="min-h-tap rounded-lg border border-border px-3 font-medium text-fg-muted"
        >
          Rapikan
        </button>
      </div>

    <div ref={surfaceRef} className="relative px-4 pt-1" style={{ height }}>
      {ids.map((id, index) => {
        const base = layouts[id];
        if (!base) return null;
        const layout = live?.id === id ? live.layout : base;
        const active = live?.id === id;
        const cardWidth = Math.max(MIN_CARD_PX, layout.w * canvasWidth);
        const open = expanded.has(id);

        return (
          <div
            key={id}
            className="group absolute"
            style={{
              left: layout.x * canvasWidth,
              top: layout.y,
              width: cardWidth,
              // The card in hand is drawn above the ones it passes over.
              // Without this it slides underneath them and the gesture looks
              // like it stopped working. An expanded card outranks a resting
              // one for the same reason: it is deliberately overflowing its
              // own footprint.
              zIndex: active ? 40 : open ? 20 : 1,
              // No transition while a gesture is running: a card that eases
              // toward the pointer lags behind it, and the lag reads as the
              // app being slow rather than as an animation.
              transition: active
                ? 'none'
                : 'left 120ms ease, top 120ms ease, width 120ms ease',
            }}
          >
            <CanvasHandle onPointerDown={(event) => beginGesture(event, id, 'move')} />

            <ClampedCard
              id={id}
              cap={open ? 0 : layout.hMax}
              expanded={open}
              onNaturalHeight={recordHeight}
              onToggle={() => toggleExpanded(id)}
            >
              {items[index]}
            </ClampedCard>

            <Grip
              axis="width"
              onPointerDown={(event) => beginGesture(event, id, 'width')}
              onReset={() => commit(id, { ...layout, w: DEFAULT_W })}
            />
            <Grip
              axis="height"
              onPointerDown={(event) => beginGesture(event, id, 'height')}
              onReset={() => commit(id, { ...layout, hMax: 0 })}
            />
          </div>
        );
      })}
    </div>
    </>
  );
}

/**
 * A card with an optional height cap, and the fade that admits there is more.
 *
 * The fade is drawn ONLY when the content is actually taller than the cap,
 * which is why the natural height is measured rather than assumed. A permanent
 * fade under every capped card would claim there is more below on cards where
 * there is not, and a signal that is sometimes false is one that stops being
 * read.
 */
function ClampedCard({
  id,
  cap,
  expanded,
  onNaturalHeight,
  onToggle,
  children,
}: {
  id: string;
  /** Maximum height in pixels, or 0 for none. */
  cap: number;
  expanded: boolean;
  onNaturalHeight: (id: string, value: number) => void;
  onToggle: () => void;
  children: ReactNode;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = (): void => {
      // `scrollHeight` rather than a bounding rect: the rect reports the
      // CLAMPED height, which is the very number being compared against.
      const value = node.scrollHeight;
      setNatural(value);
      onNaturalHeight(id, value);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, [id, onNaturalHeight]);

  const clipped = cap > 0 && natural > cap + 4;

  return (
    <div
      ref={ref}
      className="relative"
      style={cap > 0 ? { maxHeight: cap, overflow: 'hidden' } : undefined}
    >
      {children}
      {clipped ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label="Tampilkan sisa kartu"
          className="absolute inset-x-0 bottom-0 flex h-8 items-end justify-center rounded-b-xl text-[10px] font-medium text-fg-faint"
          style={{
            // A fade rather than a hard cut: a clean edge through a line of
            // text reads as a rendering fault, and the first response to a
            // rendering fault is to distrust the rest of the card.
            backgroundImage: 'linear-gradient(to bottom, transparent, var(--bg) 85%)',
          }}
        >
          <span aria-hidden="true">▾</span>
        </button>
      ) : null}
      {expanded ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label="Kembalikan batas tinggi kartu"
          className="absolute right-1 top-1 min-h-tap min-w-tap text-xs text-fg-faint"
        >
          <span aria-hidden="true">▴</span>
        </button>
      ) : null}
    </div>
  );
}

/**
 * A resize grip on one edge.
 *
 * Two grips, not one corner. A single corner handle changes both dimensions in
 * one gesture, so setting a width you like also nudges a height cap you had
 * already set — and in a horizontal drag most of the vertical movement is
 * unintentional. One axis per grip means the gesture cannot do something you
 * did not ask for.
 *
 * Narrow but long: the hit area runs the whole edge, which is what makes a
 * thin strip grabbable without a 44 px band of dead space around every card.
 *
 * Double-click resets that axis — the escape hatch for a card dragged to a
 * size too small to grab your way back out of.
 */
function Grip({
  axis,
  onPointerDown,
  onReset,
}: {
  axis: 'width' | 'height';
  onPointerDown: (event: React.PointerEvent) => void;
  onReset: () => void;
}): JSX.Element {
  const horizontal = axis === 'width';
  return (
    <button
      type="button"
      aria-label={horizontal ? 'Ubah lebar kartu' : 'Ubah batas tinggi kartu'}
      onPointerDown={onPointerDown}
      onDoubleClick={onReset}
      onClick={(event) => event.preventDefault()}
      className={[
        'absolute touch-none rounded bg-border opacity-0 transition-opacity',
        'group-hover:opacity-100 focus-visible:opacity-100',
        horizontal
          ? 'inset-y-6 -right-1 w-1.5 cursor-ew-resize'
          : 'inset-x-6 -bottom-1 h-1.5 cursor-ns-resize',
      ].join(' ')}
    />
  );
}

/**
 * The grab strip, above the card rather than inside it.
 *
 * Outside `PatientCard` on purpose: the card is a `<Link>`, and a drag gesture
 * starting anywhere on it races the navigation on every tap. A dedicated strip
 * means tapping the card still opens the patient — the thing done with this
 * board all day — and only this bar moves it.
 */
function CanvasHandle({
  onPointerDown,
}: {
  onPointerDown: (event: React.PointerEvent) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label="Geser kartu"
      onPointerDown={onPointerDown}
      onClick={(event) => event.preventDefault()}
      className="min-h-tap w-full cursor-grab touch-none rounded-t-xl text-center text-xs leading-none text-fg-faint"
    >
      <span aria-hidden="true">⠿</span>
    </button>
  );
}
