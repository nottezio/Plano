import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  renderItem,
  enabled,
  actionsSlot,
}: {
  /** Every card on the board, in board order. Drives auto-placement. */
  ids: readonly string[];
  /**
   * Renders one card. A function rather than a ready-made list because the
   * canvas is what knows whether a card has been capped, and a capped card has
   * to be told to fit its height — which is a prop on the card, decided here.
   */
  renderItem: (id: string, options: { fitHeight: boolean }) => ReactNode;
  /** False while another order is selected; the canvas then renders nothing. */
  enabled: boolean;
  /**
   * Where to put Rapikan / Urungkan — a node in the board's own toolbar.
   *
   * Portalled rather than rendered in place. Its own row cost a full line of
   * vertical space above every card on the board, and the layout it acts on
   * lives here, so lifting the state up to reach the toolbar would give two
   * components the ability to write the same arrangement. A portal keeps one
   * owner and puts the buttons where there is already a row for them.
   */
  actionsSlot?: HTMLElement | null;
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

  /**
   * Commit one card — and FREEZE every other card where it currently sits.
   *
   * This is the fix for resizing feeling like the board snaps out from under
   * you. `placeAll` auto-places cards that have no stored position, and it
   * skips slots occupied by cards that DO. So the moment one card was
   * committed it joined the occupancy map, the auto-placement of every other
   * card was recomputed against a map that had changed, and cards that had
   * never been touched moved. Resizing one card rearranged its neighbours;
   * doing it a second time "worked" only because by then everything was
   * placed.
   *
   * Writing the resolved layout of the whole board makes the arrangement on
   * screen the arrangement on disk. Nothing can move because of something the
   * user did to a different card, and auto-placement is left to do the one job
   * it is good at: finding a slot for a patient who has just arrived.
   */
  const commit = useCallback(
    (id: string, layout: CardLayout, resolved: CanvasLayouts) => {
      const next: CanvasLayouts = { ...resolved, [id]: layout };
      setStored(next);
      writeLayouts(next);
    },
    [],
  );

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
        commit(id, latest, layouts);
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
      {actionsSlot
        ? createPortal(
            <>
              {undo ? (
                <button
                  type="button"
                  onClick={() => {
                    applyLayouts(undo);
                    setUndo(null);
                  }}
                  className="min-h-tap shrink-0 rounded-lg border border-border px-3 text-xs font-medium text-accent"
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
                className="min-h-tap shrink-0 rounded-lg border border-border px-3 text-xs font-medium text-fg-muted"
              >
                Rapikan
              </button>
            </>,
            actionsSlot,
          )
        : null}

    <div ref={surfaceRef} className="relative px-4 pt-1" style={{ height }}>
      {ids.map((id) => {
        const base = layouts[id];
        if (!base) return null;
        const layout = live?.id === id ? live.layout : base;
        const active = live?.id === id;
        const cardWidth = Math.max(MIN_CARD_PX, layout.w * canvasWidth);
        const open = expanded.has(id);

        return (
          <div
            key={id}
            data-active={active ? 'true' : undefined}
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
              {renderItem(id, { fitHeight: !open && layout.hMax > 0 })}
            </ClampedCard>

            <Grip
              axis="width"
              onPointerDown={(event) => beginGesture(event, id, 'width')}
              onReset={() => commit(id, { ...layout, w: DEFAULT_W }, layouts)}
            />
            <Grip
              axis="height"
              onPointerDown={(event) => beginGesture(event, id, 'height')}
              onReset={() => commit(id, { ...layout, hMax: 0 }, layouts)}
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
      /*
        `height`, not `maxHeight`, when capped.

        The card inside is a flex column that gives up its middle first, and a
        flex column can only distribute a height it has been given. Under
        `maxHeight` the column sizes to its content and the browser then clips
        the overflow — which cuts the progress strip off the bottom, the one
        part of a short card that still has to be readable.
      */
      style={cap > 0 ? { height: cap, overflow: 'hidden' } : undefined}
    >
      {children}
      {/*
        The expand affordance, in the corner rather than as a bar across the
        bottom.

        The bar used to sit over the progress strip — which, now that a capped
        card keeps its strip readable, is precisely the thing it would hide.
        The fade over the clipped text is drawn by the card itself, where the
        card knows its own background colour.
      */}
      {clipped ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label="Tampilkan sisa kartu"
          className="absolute bottom-0 right-0 min-h-tap min-w-tap text-xs text-token-fg/60"
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
        // Visible while the gesture runs, not only while hovered. The pointer
        // leaves the card the instant a resize starts — it is being captured,
        // not tracked — so a hover-only grip vanishes mid-drag and the gesture
        // reads as having been dropped.
        'absolute touch-none rounded bg-border opacity-0 transition-opacity',
        'group-hover:opacity-100 group-data-[active=true]:opacity-100 focus-visible:opacity-100',
        horizontal
          ? 'inset-y-6 -right-1 w-1.5 cursor-ew-resize'
          : 'inset-x-6 -bottom-1 h-1.5 cursor-ns-resize',
      ].join(' ')}
    />
  );
}

/**
 * The grab handle, OVERLAID in the gap above the card rather than stacked on
 * top of it.
 *
 * It used to be a full-width strip in normal flow, and a strip in flow has to
 * be tall enough to press — 44 px — which it then took from every card on the
 * board, whether or not anyone was dragging. Forty-four pixels times twelve
 * cards is most of a screen spent on an affordance used a few times a week.
 *
 * Absolutely positioned above the card's top edge, it costs nothing: it sits
 * in the gap that already exists between rows, and appears on hover. That is
 * safe here in a way it is not inside `PatientCard` — the warning there is
 * about abspos inside a multi-column fragment; this wrapper is a plain
 * positioned box on the canvas.
 *
 * Still a handle rather than the whole card. The card is a `<Link>` and a
 * long-press target, and a drag starting anywhere on it would have to win a
 * race against both — losing it either opens a chart you did not ask for or
 * moves a card you did not mean to move.
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
      className="absolute -top-4 left-2 z-10 flex h-4 w-12 cursor-grab touch-none items-center justify-center rounded bg-border text-[10px] leading-none text-fg-faint opacity-0 transition-opacity group-hover:opacity-100 group-data-[active=true]:opacity-100 focus-visible:opacity-100"
    >
      <span aria-hidden="true">⠿</span>
    </button>
  );
}
