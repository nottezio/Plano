import { useState } from 'react';
import { createPortal } from 'react-dom';

import type { BoardStickersState } from '@/hooks/useBoardStickers';
import {
  STICKER_GROUPS,
  addSticker,
  dropSticker,
  freeStickers,
  removeSticker,
  stickerLabel,
  stickerTilt,
  stickersOnCard,
  type BoardSticker,
} from '@/domain/board/stickers';

/**
 * The sticker layer of the canvas.
 *
 * Two places draw stickers, from ONE list (`useBoardStickers`):
 *
 *   - `CanvasStickers`, on the canvas surface: the picker, and every sticker
 *     that is FREE — not stuck on a card.
 *   - `CardStickers`, inside each card's own box: the stickers stuck on that
 *     card. Being inside the card's box is what makes them move with it —
 *     including mid-drag — with no position kept in step by hand.
 *
 * Dropping a sticker on a card sticks it there; dropping it on empty canvas
 * frees it. See `domain/board/stickers` for the rules.
 */

/** Marks the canvas surface, so a drag started inside a card can find it. */
export const SURFACE_ATTR = 'data-canvas-surface';
/** Marks each card's box on the canvas; carries the card's id. */
export const CARD_ATTR = 'data-canvas-id';

/**
 * One drag, from pointer-down to drop, on WINDOW listeners.
 *
 * Not pointer capture on the sticker, as before: a sticker pulled off a card
 * is re-rendered on the canvas the moment the drag starts — a different
 * element — and capture on the old one ends with it. Window listeners do not
 * care which element is drawing the sticker, so the gesture survives the move
 * between the card and the canvas, both ways.
 */
function startStickerDrag(
  event: React.PointerEvent<HTMLElement>,
  sticker: BoardSticker,
  state: BoardStickersState,
): void {
  const surface = event.currentTarget.closest<HTMLElement>(`[${SURFACE_ATTR}]`);
  if (!surface) return;
  event.preventDefault();
  event.stopPropagation();

  const box = surface.getBoundingClientRect();
  const width = Math.max(surface.clientWidth, 1);
  const own = event.currentTarget.getBoundingClientRect();
  // Where the pointer took hold of the sticker, so it does not jump to put its
  // corner under the finger.
  const grabX = event.clientX - own.left;
  const grabY = event.clientY - own.top;

  const toCanvas = (clientX: number, clientY: number): { x: number; y: number } => ({
    x: (clientX - grabX - box.left) / width,
    y: clientY - grabY - box.top,
  });

  // Freed for the duration of the drag, drawn on the canvas where it already is.
  let current = dropSticker(state.stickers, sticker.id, toCanvas(event.clientX, event.clientY), null);
  state.preview(current);

  const onMove = (movement: PointerEvent): void => {
    current = dropSticker(current, sticker.id, toCanvas(movement.clientX, movement.clientY), null);
    // In memory while dragging; stored once on release, so a drag across the
    // board is one storage write, not a hundred.
    state.preview(current);
  };

  const onUp = (release: PointerEvent): void => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);

    const at = toCanvas(release.clientX, release.clientY);
    /*
      The card under the pointer, if any. `elementsFromPoint` sees through the
      sticker itself (drawn on the canvas layer, not inside any card) to the
      topmost card beneath it.
    */
    const card = document
      .elementsFromPoint(release.clientX, release.clientY)
      .map((element) => element.closest<HTMLElement>(`[${CARD_ATTR}]`))
      .find((element): element is HTMLElement => element !== null);
    const cardId = card?.getAttribute(CARD_ATTR);

    if (card && cardId) {
      const rect = card.getBoundingClientRect();
      state.persist(
        dropSticker(current, sticker.id, at, {
          id: cardId,
          dx: release.clientX - grabX - rect.left,
          dy: release.clientY - grabY - rect.top,
        }),
      );
    } else {
      state.persist(dropSticker(current, sticker.id, at, null));
    }
  };

  // A drag the browser took over is abandoned: put everything back.
  const onCancel = (): void => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    state.preview(state.stickers);
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
}

/**
 * One sticker, die-cut. Used on the canvas and on cards alike, so the two can
 * never look or behave differently.
 */
function StickerGlyph({
  sticker,
  state,
  style,
}: {
  sticker: BoardSticker;
  state: BoardStickersState;
  style: React.CSSProperties;
}): JSX.Element {
  return (
    <div className="group/sticker absolute z-40 select-none" style={{ ...style, touchAction: 'none' }}>
      <button
        type="button"
        aria-label={`Geser penanda ${stickerLabel(sticker.emoji)}`}
        title={stickerLabel(sticker.emoji)}
        onPointerDown={(event) => startStickerDrag(event, sticker, state)}
        // A sticker on a card sits inside the card's link: a click on it must
        // not open the patient.
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        /*
          DIE-CUT, like a vinyl sticker: a white border that follows the
          emoji's own outline, then a drop shadow under the whole thing.
          Four offset copies of the glyph in white (`drop-shadow` with no blur)
          make the border; one soft dark shadow makes it sit on top. The tilt
          comes from the id, so it is the same on every draw.
        */
        style={{
          filter:
            'drop-shadow(2px 0 0 white) drop-shadow(-2px 0 0 white) drop-shadow(0 2px 0 white) drop-shadow(0 -2px 0 white) drop-shadow(0 3px 3px rgba(0,0,0,0.55))',
          transform: `rotate(${String(stickerTilt(sticker.id))}deg)`,
        }}
        className="cursor-grab p-1 text-3xl leading-none"
      >
        <span aria-hidden="true">{sticker.emoji}</span>
      </button>

      {/* Removal is deliberate and small: a sticker is easy to place again,
          and a confirmation for one would cost more than the mistake. */}
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          state.persist(removeSticker(state.stickers, sticker.id));
        }}
        aria-label={`Hapus penanda ${stickerLabel(sticker.emoji)}`}
        className="absolute -right-2 -top-1 hidden h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-[10px] text-fg-muted group-hover/sticker:flex"
      >
        ×
      </button>
    </div>
  );
}

/** The stickers stuck on one card, drawn inside that card's box. */
export function CardStickers({
  cardId,
  state,
}: {
  cardId: string;
  state: BoardStickersState;
}): JSX.Element | null {
  const mine = stickersOnCard(state.stickers, cardId);
  if (mine.length === 0) return null;
  return (
    <>
      {mine.map((sticker) => (
        <StickerGlyph
          key={sticker.id}
          sticker={sticker}
          state={state}
          style={{ left: sticker.card?.dx ?? 0, top: sticker.card?.dy ?? 0 }}
        />
      ))}
    </>
  );
}

/** The picker, and the free stickers, on the canvas surface. */
export function CanvasStickers({
  surfaceRef,
  enabled,
  actionsSlot,
  state,
}: {
  /** The canvas surface, for placing a new sticker in its coordinates. */
  surfaceRef: React.RefObject<HTMLDivElement>;
  enabled: boolean;
  /**
   * The board toolbar, where the button belongs — beside Rapikan and
   * Urungkan, not pinned over the corner of a card.
   */
  actionsSlot?: HTMLElement | null;
  state: BoardStickersState;
}): JSX.Element | null {
  const [picking, setPicking] = useState(false);

  if (!enabled) return null;

  const place = (emoji: string): void => {
    const width = surfaceRef.current?.clientWidth ?? 1;
    /*
      Dropped near the top left, where the eye already is after using the
      picker, offset per sticker so a second one does not land exactly on the
      first and look like nothing happened. Free until dragged onto a card.
    */
    const index = state.stickers.length % 6;
    state.persist(
      addSticker(state.stickers, {
        id: `st-${String(Date.now())}-${String(index)}`,
        emoji,
        x: (16 + index * 44) / Math.max(width, 1),
        y: 8,
      }),
    );
    setPicking(false);
  };

  return (
    <>
      {actionsSlot
        ? createPortal(
            <span className="relative shrink-0">
              <button
                type="button"
                onClick={() => setPicking((open) => !open)}
                aria-expanded={picking}
                title="Tempel penanda di papan"
                className="min-h-tap shrink-0 rounded-lg border border-border px-3 text-xs font-medium text-fg"
              >
                🚩 Penanda
              </button>
              {picking ? (
                /*
                  Hangs BELOW the toolbar, over the top of the board. It covers
                  cards only while it is open, and closes as soon as a marker
                  is picked.
                */
                <div
                  role="group"
                  aria-label="Pilih penanda"
                  className="absolute right-0 top-full z-50 mt-1 max-h-[70vh] w-[288px] space-y-2 overflow-y-auto rounded-lg border border-border bg-surface p-2 shadow-lg"
                >
                  <p className="text-[11px] text-fg-muted">
                    Seret penanda ke atas kartu agar ikut berpindah bersama kartunya.
                  </p>
                  {STICKER_GROUPS.map((group) => (
                    <div key={group.title}>
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg-faint">
                        {group.title}
                      </p>
                      <div className="flex flex-wrap gap-0.5">
                        {group.stickers.map((sticker) => (
                          <button
                            key={sticker.emoji}
                            type="button"
                            onClick={() => place(sticker.emoji)}
                            aria-label={`Tempel ${sticker.label}`}
                            title={sticker.label}
                            className="flex min-h-tap w-11 items-center justify-center rounded text-2xl hover:bg-bg-subtle"
                          >
                            {sticker.emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </span>,
            actionsSlot,
          )
        : null}

      {freeStickers(state.stickers).map((sticker) => (
        <StickerGlyph
          key={sticker.id}
          sticker={sticker}
          state={state}
          style={{ left: `${String(sticker.x * 100)}%`, top: sticker.y }}
        />
      ))}
    </>
  );
}
