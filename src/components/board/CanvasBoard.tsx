import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

import {
  DEFAULT_W,
  MIN_CARD_PX,
  ROW_STEP,
  SHELF_HEADER_PX,
  SHELF_ROW_PX,
  addShelf,
  isShelfId,
  removeShelf,
  shelfAtFor,
  shelfContents,
  shelfOf,
  shelve,
  shelvesOf,
  unshelve,
  applyGesture,
  columnsFor,
  mergeLayouts,
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
  layoutIds,
  renderItem,
  enabled,
  actionsSlot,
  isUncapped,
  overlay,
  renderInCard,
  seed,
  onStoredChange,
  scope = 'mine',
}: {
  /** The board view (Pasien saya / Titipan): each has its own shelves (2026-10-17). */
  scope?: string | undefined;
  /**
   * The account's copy, used only when this device has no layout yet (a new
   * laptop). See `SharedCanvas`.
   */
  seed?: CanvasLayouts | undefined;
  /** Called after the stored layout changes, to mirror it to the account. */
  onStoredChange?: ((layouts: CanvasLayouts, canvasWidth: number) => void) | undefined;
  /** Every card on the board, in board order. Drives auto-placement. */
  ids: readonly string[];
  /**
   * Every id the layout must make room for, visible or not: the whole scope,
   * unfiltered. `ids` is what is DRAWN. Placement and Rapikan used to run over
   * `ids` alone, so during a search they packed the matches into slots the
   * hidden cards were sitting in, and after the search the cards overlapped.
   */
  layoutIds?: readonly string[] | undefined;
  /**
   * Renders one card. A function rather than a ready-made list because the
   * canvas is what knows whether a card has been capped, and a capped card has
   * to be told to fit its height — which is a prop on the card, decided here.
   */
  renderItem: (
    id: string,
    options: {
      fitHeight: boolean;
      /** Reported by the card; clamps the height grip. */
      onHeightBounds: (bounds: { min: number; max: number }) => void;
      maxPreviewLines: number;
    },
  ) => ReactNode;
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
  /**
   * Cards that ignore their height cap right now — a patient card whose note
   * is open.
   *
   * Opening a note is a request to read it. Under the cap the note took its
   * height from the body above it, so the diagnoses faded out exactly when
   * the card was opened to be read. While this returns true the card renders
   * at its natural height; closing the note gives the cap back, unchanged.
   *
   * Asked of the board, not measured from the card: the board already holds
   * which notes are open, and a card reporting "uncap me" through its own
   * measurement would stop measuring the moment it was uncapped.
   */
  /**
   * Why, if at all: `'note'` — its note is open; `'folded'` — folded to one
   * line. The canvas treats them differently: a folded card has no height to
   * cap, so it gets no height grip; a card with an open note keeps its grip,
   * and a drag on it is honoured (see `capOverride`).
   */
  isUncapped?: ((id: string) => false | 'note' | 'folded') | undefined;
  /**
   * Rendered inside the canvas surface, above the cards — the sticker layer.
   * Given the surface so it can place by the same coordinates the cards use,
   * rather than being handed positions it cannot recompute on a resize.
   */
  overlay?: ((surfaceRef: React.RefObject<HTMLDivElement>) => JSX.Element | null) | undefined;
  /** Drawn inside each card's box, above the card — the stickers stuck on it. */
  renderInCard?: ((id: string) => JSX.Element | null) | undefined;
}): JSX.Element {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [stored, setStored] = useState<CanvasLayouts>(() => {
    const local = readLayouts();
    return Object.keys(local).length === 0 && seed ? seed : local;
  });
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

  /*
    Mirror every stored change. Skipped on mount: reading is not a change,
    and a layout seeded from the account must not be written straight back.
  */
  const mounted = useRef(false);
  const notify = useRef(onStoredChange);
  notify.current = onStoredChange;
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (width > 0) notify.current?.(stored, width);
  }, [stored, width]);
  /*
    Shelves (2026-10-16): placed like cards, first, so a new patient is never
    auto-placed under one. A card on a shelf takes no place on the canvas.
  */
  const shelfIds = useMemo(() => shelvesOf(stored, scope), [stored, scope]);
  const [shelfHeights, setShelfHeights] = useState<Readonly<Record<string, number>>>({});
  const placementIds = useMemo(() => {
    const all = layoutIds ? [...ids, ...layoutIds.filter((id) => !new Set(ids).has(id))] : [...ids];
    return [...shelfIds, ...all.filter((id) => !shelfOf(stored, id))];
  }, [ids, layoutIds, shelfIds, stored]);
  const layouts = useMemo(
    () => placeAll(placementIds, stored, columns, shelfHeights),
    [placementIds, stored, columns, shelfHeights],
  );
  /**
   * The shelf under the card being dragged, lit up as a drop target, and
   * where among its cards it would go (2026-10-17: a drop inside a shelf
   * reorders it) — the number of rows whose middle is above the pointer.
   */
  const [dropShelf, setDropShelf] = useState<{ shelf: string; index: number } | null>(null);
  const shelfAt = useCallback((clientX: number, clientY: number): { shelf: string; index: number } | null => {
    const nodes = surfaceRef.current?.querySelectorAll<HTMLElement>('[data-shelf-id]') ?? [];
    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) continue;
      const rows = [...node.querySelectorAll<HTMLElement>('[data-shelf-row]')];
      const index = rows.filter((row) => {
        const r = row.getBoundingClientRect();
        return r.top + r.height / 2 < clientY;
      }).length;
      return node.dataset.shelfId ? { shelf: node.dataset.shelfId, index } : null;
    }
    return null;
  }, []);

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
   * Each card's measured height range, reported by the card itself.
   *
   * A ref, not state: these arrive from a ResizeObserver on every card and are
   * read only at the moment a drag starts. Holding them in state would
   * re-render the whole board every time any card reflowed, to store a number
   * nothing on screen displays.
   */
  const heightBounds = useRef(new Map<string, { min: number; max: number }>());
  const boundsSetters = useRef(new Map<string, (bounds: { min: number; max: number }) => void>());

  /**
   * Each card's MINIMUM, as state — the one bound the render needs.
   *
   * The ref above is enough for the grip, which reads bounds only when a drag
   * starts. It was not enough for the render: a cap is stored, and the card
   * can grow a taller minimum later — its note is opened, a badge appears — so
   * a cap that was valid when set can be too small now. Rendered at
   * `height: cap`, the parts that must not shrink (header, progress, note)
   * then overflowed each other: the "Belum:" line printed over the note.
   *
   * Re-renders only when a card's minimum CHANGES, which is rare (content,
   * not every reflow), so the reason the ref exists still holds.
   *
   * The maximum is kept too: a cap is a MAXIMUM (`hMax`), so a card whose
   * content needs less than its cap — a folded card above all — renders at
   * what it needs instead of sitting at the top of a tall empty slot.
   */
  /**
   * The card last touched, drawn in front of every card at rest.
   *
   * Stacking was fixed: the card being dragged on top, expanded cards next,
   * everything else level. So a card that ended up partly under another stayed
   * there — its drag tab and its grips under the other card, unreachable, with
   * no way to bring it forward. Now pressing any visible part of it raises it,
   * and its tab and grips are reachable again.
   *
   * On pointer DOWN, in the capture phase, so the card rises before the drag
   * or resize that the same press may start — and so nothing inside the card
   * can swallow the event first.
   *
   * Not remembered. It is "what I am working on now", and a stacking order
   * restored from yesterday would put yesterday's card on top.
   */
  const [frontId, setFrontId] = useState<string | null>(null);

  const [renderBounds, setRenderBounds] = useState<
    Readonly<Record<string, { min: number; max: number }>>
  >({});
  const boundsSetter = useCallback((id: string) => {
    const existing = boundsSetters.current.get(id);
    if (existing) return existing;
    // Memoised per id so the card is not handed a new callback on every
    // render — the card uses it as an effect dependency, and a fresh identity
    // each time would tear down and rebuild its observer continuously.
    const setter = (bounds: { min: number; max: number }): void => {
      heightBounds.current.set(id, bounds);
      setRenderBounds((current) => {
        const previous = current[id];
        return previous && previous.min === bounds.min && previous.max === bounds.max
          ? current
          : { ...current, [id]: bounds };
      });
    };
    boundsSetters.current.set(id, setter);
    return setter;
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

  /** The stored map now, for gestures that end after a render (shelves read it). */
  const storedRef = useRef(stored);
  storedRef.current = stored;
  const idsRef = useRef(ids);
  idsRef.current = ids;
  /** Replace the whole map — for removing a shelf, which a merge cannot do. */
  const applyLayoutsReplacing = useCallback((next: CanvasLayouts) => {
    writeLayouts(next);
    setStored(next);
  }, []);

  const applyLayouts = useCallback((resolved: CanvasLayouts) => {
    // Merged, never replaced: `resolved` only covers the scope on screen, and
    // the store holds every patient. See `mergeLayouts`.
    setStored((previous) => {
      const next = mergeLayouts(previous, resolved);
      writeLayouts(next);
      return next;
    });
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
      setStored((previous) => {
        const next = mergeLayouts(previous, resolved, id, layout);
        writeLayouts(next);
        return next;
      });
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
    (event: React.PointerEvent, id: string, mode: 'move' | 'width' | 'height', start?: CardLayout) => {
      const surface = surfaceRef.current;
      if (!surface) return;

      const handle = event.currentTarget as HTMLElement;
      // Capture, so the gesture keeps reporting after the finger leaves the
      // grip — which happens immediately, since moving away is the point.
      handle.setPointerCapture(event.pointerId);

      const measured = surface.getBoundingClientRect().width || 1;
      const natural = naturalHeights.current.get(id) ?? 0;
      // `start`: a card lifted off a shelf begins where its row was.
      const stored: CardLayout = start ?? layouts[id] ?? { x: 0, y: 0, w: DEFAULT_W, hMax: 0 };
      const droppable = mode === 'move' && !isShelfId(id);
      let pointer = { x: event.clientX, y: event.clientY };
      /*
        A height drag on a card its note has uncapped starts from the height
        it is SHOWING, not from the cap stored before the note opened. From
        the stored cap the card would jump to that height the instant the drag
        began — a resize that first moves somewhere you did not point.
      */
      /*
        A height drag on a card its note has uncapped starts from the height
        it is SHOWING, not from the cap stored before the note opened — from
        the stored cap the card would jump the instant the drag began.

        `hMaxWithNote` records the decision WITH the layout, so it survives a
        remount. It was session state for one release, which is why a resized
        card reverted to full height on switching tabs: the height was saved
        and then ignored.
      */
      const takingOver =
        mode === 'height' && isUncapped?.(id) === 'note' && !stored.hMaxWithNote;
      const origin: CardLayout = takingOver ? { ...stored, hMax: natural || stored.hMax } : stored;
      const bounds = heightBounds.current.get(id);
      const startX = event.clientX;
      const startY = event.clientY;
      let latest = origin;

      const onMove = (movement: PointerEvent): void => {
        pointer = { x: movement.clientX, y: movement.clientY };
        if (droppable) {
          const over = shelfAt(movement.clientX, movement.clientY);
          setDropShelf((current) => (current?.shelf === over?.shelf && current?.index === over?.index ? current : over));
        }
        // The arithmetic lives in the domain, where it is tested. This handler
        // owns the gesture; it does not own what a gesture means.
        latest = applyGesture(mode, origin, {
          dx: movement.clientX - startX,
          dy: movement.clientY - startY,
          canvasWidth: measured,
          natural,
          ...(bounds ? { minH: bounds.min, maxH: bounds.max } : {}),
        });

        setLive({
          id,
          layout:
            mode === 'height' && isUncapped?.(id) === 'note'
              ? { ...latest, hMaxWithNote: true }
              : latest,
        });
      };

      const onUp = (): void => {
        setLive(null);
        setDropShelf(null);
        // Dropped on a shelf: onto it, at the place among its cards it was
        // dropped (its own shelf too — that is a reorder, 2026-10-17).
        const target = droppable ? shelfAt(pointer.x, pointer.y) : null;
        if (target) {
          const order = shelfContents(storedRef.current, target.shelf, idsRef.current).filter((other) => other !== id);
          commit(id, shelve(unshelve(origin), target.shelf, shelfAtFor(storedRef.current, order, target.index)), layouts);
        } else
        commit(
          id,
          mode === 'height' && isUncapped?.(id) === 'note'
            ? { ...latest, hMaxWithNote: true }
            : unshelve(latest),
          layouts,
        );
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
    // `isUncapped` is an inline arrow from the board, so this re-creates each
    // render. Harmless: every grip already calls it through an inline arrow.
    [layouts, commit, isUncapped, shelfAt],
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
      if (!layout || shelfOf(stored, id)) return max;
      return Math.max(max, layout.y + (layout.hMax || ROW_STEP));
    }, 0);
    const shelves = shelfIds.reduce((max, id) => {
      const layout = layouts[id];
      return layout ? Math.max(max, layout.y + (shelfHeights[id] ?? SHELF_HEADER_PX + SHELF_ROW_PX)) : max;
    }, 0);
    return Math.max(lowest, shelves) + 160;
  }, [ids, layouts, stored, shelfIds, shelfHeights]);

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
                  className="min-h-tap shrink-0 rounded-lg border border-border px-2.5 text-xs font-medium text-accent [@media(pointer:fine)]:min-h-9"
                >
                  Undo
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  const { id, layout } = addShelf(columns, height - 160, scope);
                  commit(id, layout, layouts);
                }}
                title="Shelf: tempat menyimpan kartu yang dilipat (mis. pasien pulang, berkas belum selesai). Seret kartu ke shelf. Pasien saya dan Titipan punya shelf sendiri."
                className="min-h-tap shrink-0 rounded-lg px-2.5 text-xs font-medium text-fg-muted hover:bg-bg-subtle [@media(pointer:fine)]:min-h-9"
              >
                + Shelf
              </button>
              <button
                type="button"
                onClick={() => {
                  setUndo(layouts);
                  applyLayouts(tidy(placementIds, layouts, columns, shelfHeights));
                }}
                title="Rapatkan kartu, tanpa mengubah urutan yang sudah diatur"
                className="min-h-tap shrink-0 rounded-lg px-2.5 text-xs font-medium text-fg-muted hover:bg-bg-subtle [@media(pointer:fine)]:min-h-9"
              >
                Rapikan
              </button>
            </>,
            actionsSlot,
          )
        : null}

    {/*
      `mt-5`: room ABOVE the surface for the drag handle of a card at y = 0.
      The handle is drawn 16 px above its card (see CanvasHandle), and card
      positions are floored at the surface's top edge, so a card moved to the
      very top had its handle outside the surface, under the pinned board
      header, where it could not be grabbed. Padding would not do it: cards
      are absolutely positioned and padding does not move them; a margin
      moves the whole surface, cards and stickers alike, with no stored
      position changing.
    */}
    <div ref={surfaceRef} data-canvas-surface="" className="relative mt-5 px-4" style={{ height }}>
      {overlay?.(surfaceRef)}
      {shelfIds.map((shelfId) => {
        const base = layouts[shelfId];
        if (!base) return null;
        const layout = live?.id === shelfId ? live.layout : base;
        return (
          <ShelfBox
            key={shelfId}
            id={shelfId}
            layout={layout}
            canvasWidth={canvasWidth}
            active={live?.id === shelfId}
            front={frontId === shelfId}
            dropIndex={dropShelf?.shelf === shelfId ? dropShelf.index : null}
            contents={shelfContents(stored, shelfId, ids).filter((id) => live?.id !== id)}
            renderItem={(id) => renderItem(id, { fitHeight: false, onHeightBounds: noBounds, maxPreviewLines: 4 })}
            onFront={() => {
              if (frontId !== shelfId) setFrontId(shelfId);
            }}
            onMove={(event) => beginGesture(event, shelfId, 'move')}
            onWidth={(event) => beginGesture(event, shelfId, 'width')}
            onChange={(next) => commit(shelfId, next, layouts)}
            onRemove={() => applyLayoutsReplacing(removeShelf(storedRef.current, shelfId, ids, shelfHeights[shelfId] ?? SHELF_HEADER_PX))}
            onTakeOut={(id) => {
              const shelfH = shelfHeights[shelfId] ?? SHELF_HEADER_PX;
              const own = storedRef.current[id] ?? { x: 0, y: 0, w: DEFAULT_W, hMax: 0 };
              commit(id, unshelve(own, { x: layout.x, y: layout.y + shelfH + 12 }), layouts);
            }}
            onLift={(event, id, rect) => {
              const surface = surfaceRef.current?.getBoundingClientRect();
              const own = storedRef.current[id];
              if (!surface || !own) return;
              beginGesture(event, id, 'move', { ...unshelve(own), x: Math.max(0, (rect.left - surface.left) / canvasWidth), y: Math.max(0, rect.top - surface.top) });
            }}
            onHeight={(h) =>
              setShelfHeights((current) => (current[shelfId] === h ? current : { ...current, [shelfId]: h }))
            }
          />
        );
      })}
      {ids.map((id) => {
        const lifted = live?.id === id && !live.layout.shelf;
        if (shelfOf(stored, id) && !lifted) return null;
        const base = layouts[id] ?? (lifted ? live.layout : undefined);
        if (!base) return null;
        const layout = live?.id === id ? live.layout : base;
        const active = live?.id === id;
        const cardWidth = Math.max(MIN_CARD_PX, layout.w * canvasWidth);
        // Either shown in full for now (the corner toggle) or uncapped by the
        // board (its note is open). Both mean "render at natural height".
        const reason = isUncapped?.(id) ?? false;
        const boardUncapped =
          reason === 'folded' || (reason === 'note' && !layout.hMaxWithNote);
        const open = expanded.has(id) || boardUncapped;

        return (
          <div
            key={id}
            // Found by a dropped sticker, to know which card it landed on.
            data-canvas-id={id}
            data-active={active ? 'true' : undefined}
            onPointerDownCapture={() => {
              if (frontId !== id) setFrontId(id);
            }}
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
              zIndex: active ? 40 : id === frontId ? 30 : open ? 20 : 1,
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
              floor={renderBounds[id]?.min ?? 0}
              ceiling={renderBounds[id]?.max ?? 0}
              // The corner toggle reflects only ITS own state. An uncapped
              // card is not "expanded by the toggle", and offering to
              // collapse it there would fight the note that uncapped it.
              expanded={expanded.has(id)}
              onNaturalHeight={recordHeight}
              onToggle={() => toggleExpanded(id)}
            >
              {renderItem(id, {
                fitHeight: !open && layout.hMax > 0,
                onHeightBounds: boundsSetter(id),
                // The canvas card is the size the user made it; a `…` inside
                // one with visible empty space beneath is the app refusing to
                // use the room it was given.
                maxPreviewLines: 60,
              })}
            </ClampedCard>

            {/*
              Drawn INSIDE the card's box, so whatever is here moves with the
              card — including mid-drag — without its position being kept in
              step by hand. Outside the clamped card, so a height cap never
              clips a sticker stuck near the card's edge.
            */}
            {renderInCard?.(id)}

            <Grip
              axis="width"
              onPointerDown={(event) => beginGesture(event, id, 'width')}
              onReset={() => commit(id, { ...layout, w: DEFAULT_W }, layouts)}
            />
            {/*
              No height grip on a FOLDED card only: one line has no height to
              cap, and the grip beneath it was the dark bar under folded cards.
              A card with an open note keeps its grip; see `capOverride`.
            */}
            {reason === 'folded' ? null : (
            <Grip
              axis="height"
              onPointerDown={(event) => beginGesture(event, id, 'height')}
              // Uncapping drops the decision with the cap: the flag without a
              // cap would claim a height nobody set.
              onReset={() => {
                const { hMaxWithNote: _cleared, ...rest } = layout;
                commit(id, { ...rest, hMax: 0 }, layouts);
              }}
            />
            )}
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
  floor,
  ceiling,
  expanded,
  onNaturalHeight,
  onToggle,
  children,
}: {
  id: string;
  /** Maximum height in pixels, or 0 for none. */
  cap: number;
  /**
   * The card's own minimum. Wins over `cap` when larger — a stored cap the
   * card has since outgrown is honoured as far as it can be without
   * overlapping the card's own text, and no further.
   */
  floor: number;
  /** What the content needs at most, or 0 if not yet known. */
  ceiling: number;
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
      style={
        cap > 0
          ? {
              // Never below what the card cannot shrink past, never above
              // what its content needs, and otherwise the cap.
              height: Math.max(floor, ceiling > 0 ? Math.min(cap, ceiling) : cap),
              overflow: 'hidden',
            }
          : undefined
      }
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
          className="absolute bottom-0 right-0 min-h-tap min-w-tap text-xs text-[color-mix(in_srgb,var(--token-fg)_70%,transparent)]"
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
        'absolute flex touch-none opacity-0 transition-opacity',
        'group-hover:opacity-100 group-data-[active=true]:opacity-100 focus-visible:opacity-100',
        horizontal
          ? /*
              Inset 4px, not 24px, from top and bottom.

              `inset-y-6` took 24px off BOTH ends. On a full card that is a
              reasonable bar; on a folded card, about 46px tall, it left the
              grip almost no height — the sliver in the screenshot, on the one
              card where width is the only size left to change.

              The hit area is 16px wide, centred on the edge (8px of it in the
              12px gap between cards), with the visible bar inside it. A 6px
              bar was also the target, which is a thin thing to catch.
            */
            'inset-y-1 -right-2 w-4 cursor-ew-resize justify-center'
          : 'inset-x-6 -bottom-1 h-1.5 cursor-ns-resize',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={horizontal ? 'h-full w-1.5 rounded bg-border' : 'h-full w-full rounded bg-border'}
      />
    </button>
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

const noBounds = (): void => undefined;

/**
 * A shelf on the canvas (2026-10-16, Avi; named Shelf, one set per board
 * view, reorderable, 2026-10-17): a drawer for folded cards —
 * patients sent home whose papers are not done yet — so they stop reading as
 * part of the ward. Drag a card onto it to put it away; drag it out, or
 * Keluarkan, to put it back on the canvas. The drawer closes to its header.
 *
 * Moved and widened like a card (handle above, grip at the right), named in
 * place. Removing a shelf puts its cards back under where it stood.
 */
function ShelfBox({
  id,
  layout,
  canvasWidth,
  active,
  front,
  dropIndex,
  contents,
  renderItem,
  onFront,
  onMove,
  onWidth,
  onChange,
  onRemove,
  onTakeOut,
  onLift,
  onHeight,
}: {
  id: string;
  layout: CardLayout;
  canvasWidth: number;
  active: boolean;
  front: boolean;
  /** A card held over this shelf: where it would go, else null. */
  dropIndex: number | null;
  contents: readonly string[];
  renderItem: (id: string) => ReactNode;
  onFront: () => void;
  onMove: (event: React.PointerEvent) => void;
  onWidth: (event: React.PointerEvent) => void;
  onChange: (next: CardLayout) => void;
  onRemove: () => void;
  onTakeOut: (id: string) => void;
  onLift: (event: React.PointerEvent, id: string, rect: DOMRect) => void;
  onHeight: (height: number) => void;
}): JSX.Element {
  const box = useRef<HTMLElement>(null);
  const [title, setTitle] = useState(layout.title ?? 'Shelf');
  const dropping = dropIndex !== null;
  const [asking, setAsking] = useState(false);
  useEffect(() => setTitle(layout.title ?? 'Shelf'), [layout.title]);
  const report = useRef(onHeight);
  report.current = onHeight;
  useEffect(() => {
    const node = box.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(() => report.current(Math.ceil(node.getBoundingClientRect().height)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const closed = layout.closed === true;
  const rename = (): void => {
    const next = title.trim() || 'Shelf';
    if (next !== layout.title) onChange({ ...layout, title: next });
  };

  return (
    <div
      data-shelf-id={id}
      data-active={active ? 'true' : undefined}
      onPointerDownCapture={onFront}
      className="group absolute"
      style={{
        left: layout.x * canvasWidth,
        top: layout.y,
        width: Math.max(MIN_CARD_PX, layout.w * canvasWidth),
        zIndex: active ? 40 : front ? 30 : 2,
        transition: active ? 'none' : 'left 120ms ease, top 120ms ease, width 120ms ease',
      }}
    >
      <CanvasHandle onPointerDown={onMove} />
      <section
        ref={box}
        aria-label={`Shelf ${layout.title ?? ''}`}
        className={[
          'overflow-hidden rounded-2xl border-2 border-b-[6px] bg-bg-subtle shadow-[inset_0_2px_8px_rgba(0,0,0,0.18)] transition-colors',
          dropping ? 'border-accent bg-[var(--accent-soft)]' : 'border-border-strong',
        ].join(' ')}
      >
        <header className="flex items-center gap-1 px-2 py-1.5">
          <button
            type="button"
            aria-expanded={!closed}
            aria-label={closed ? 'Buka shelf' : 'Tutup shelf'}
            onClick={() => {
              const { closed: _was, ...rest } = layout;
              onChange(closed ? rest : { ...rest, closed: true });
            }}
            className="flex min-h-tap min-w-tap shrink-0 items-center justify-center rounded-lg text-sm text-fg-muted hover:bg-bg hover:text-fg [@media(pointer:fine)]:min-h-8 [@media(pointer:fine)]:min-w-8"
          >
            {closed ? '▸' : '▾'}
          </button>
          <span aria-hidden="true" className="shrink-0 text-base leading-none">
            🗄
          </span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value.slice(0, 40))}
            onBlur={rename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
            }}
            aria-label="Nama shelf"
            className="min-w-0 flex-1 rounded-md bg-transparent px-1 text-sm font-semibold text-fg outline-none focus:bg-bg"
          />
          <span className="shrink-0 rounded-full bg-bg px-2 text-xs font-semibold tabular-nums text-fg-muted">{contents.length}</span>
          {asking ? (
            <span className="flex shrink-0 items-center gap-1 text-[11px]">
              <button type="button" onClick={onRemove} className="min-h-tap rounded-md px-1.5 font-semibold text-danger hover:underline [@media(pointer:fine)]:min-h-8">
                Hapus shelf
              </button>
              <button type="button" onClick={() => setAsking(false)} className="min-h-tap rounded-md px-1.5 text-fg-muted hover:underline [@media(pointer:fine)]:min-h-8">
                Batal
              </button>
            </span>
          ) : (
            <button
              type="button"
              aria-label="Hapus shelf"
              title={contents.length ? 'Hapus shelf — kartunya kembali ke papan' : 'Hapus shelf'}
              onClick={() => (contents.length ? setAsking(true) : onRemove())}
              className="flex min-h-tap min-w-tap shrink-0 items-center justify-center rounded-lg text-fg-faint opacity-0 hover:bg-bg hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 [@media(pointer:fine)]:min-h-8 [@media(pointer:fine)]:min-w-8"
            >
              ×
            </button>
          )}
        </header>
        {closed ? null : contents.length === 0 ? (
          <p className="mx-2 mb-2 rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-fg-muted">
            Seret kartu ke sini — mis. pasien pulang yang berkasnya belum selesai.
          </p>
        ) : (
          <ul className="space-y-1.5 px-2 pb-2">
            {contents.map((cardId, n) => (
              <li key={cardId} data-shelf-row="" className="relative flex items-start gap-1">
                {dropIndex === n ? <DropLine /> : null}
                <button
                  type="button"
                  aria-label="Geser kartu di shelf"
                  title="Seret untuk mengurutkan, atau keluar dari shelf"
                  onPointerDown={(event) => {
                    const row = (event.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                    onLift(event, cardId, row);
                  }}
                  onClick={(event) => event.preventDefault()}
                  className="mt-1 flex h-8 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-xs text-fg-faint hover:bg-bg hover:text-fg"
                >
                  ⠿
                </button>
                <div className="min-w-0 flex-1">{renderItem(cardId)}</div>
                <button
                  type="button"
                  aria-label="Keluarkan dari shelf"
                  title="Keluarkan ke papan"
                  onClick={() => onTakeOut(cardId)}
                  className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm text-fg-faint hover:bg-bg hover:text-fg"
                >
                  ↥
                </button>
                {dropIndex === contents.length && n === contents.length - 1 ? <DropLine end /> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <Grip axis="width" onPointerDown={onWidth} onReset={() => onChange({ ...layout, w: DEFAULT_W })} />
    </div>
  );
}

/** Where a held card will land among a shelf's cards. */
function DropLine({ end = false }: { end?: boolean }): JSX.Element {
  return <span aria-hidden="true" className={`pointer-events-none absolute inset-x-0 h-0.5 rounded bg-accent ${end ? '-bottom-1' : '-top-1'}`} />;
}
