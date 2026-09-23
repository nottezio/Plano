import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  STICKER_EMOJI,
  STICKER_KEY,
  addSticker,
  moveSticker,
  parseStickers,
  removeSticker,
  type BoardSticker,
} from '@/domain/board/stickers';

/**
 * The sticker layer of the canvas.
 *
 * Stickers sit ABOVE the cards, because their whole meaning is which card they
 * are next to — one parked in a margin says nothing. They take no part in the
 * card layout: nothing reflows around them and nothing is pushed by them.
 *
 * Dragged with pointer events rather than the HTML drag API: the same reason
 * the canvas uses them for cards — pointer capture keeps the gesture when the
 * pointer leaves the element, and it works with a finger.
 *
 * Positions are per device; see `domain/board/stickers`.
 */
export function CanvasStickers({
  surfaceRef,
  enabled,
  actionsSlot,
}: {
  /** The canvas surface, for turning a pointer position into a position on it. */
  surfaceRef: React.RefObject<HTMLDivElement>;
  enabled: boolean;
  /**
   * The board toolbar, where the button belongs.
   *
   * It was pinned to the top-right corner of the canvas, which is where a
   * card sits: the button covered the card it was floating over, and a
   * control that hides the thing it is meant to mark is worse than no
   * control. Rapikan and Urungkan already portal into this slot; the marker
   * picker is the same kind of thing and now sits beside them.
   */
  actionsSlot?: HTMLElement | null;
}): JSX.Element | null {
  const [stickers, setStickers] = useState<BoardSticker[]>([]);
  const [picking, setPicking] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const offset = useRef({ dx: 0, dy: 0 });

  useEffect(() => {
    try {
      setStickers(parseStickers(localStorage.getItem(STICKER_KEY)));
    } catch {
      setStickers([]);
    }
  }, []);

  const persist = (next: BoardSticker[]): void => {
    setStickers(next);
    try {
      localStorage.setItem(STICKER_KEY, JSON.stringify(next));
    } catch {
      // No storage: they last for this session, which is what a sticker is for.
    }
  };

  if (!enabled) return null;

  const place = (emoji: string): void => {
    const surface = surfaceRef.current;
    const width = surface?.clientWidth ?? 1;
    /*
      Dropped near the top left, where the eye already is after using the
      picker, and offset per sticker so a second one does not land exactly on
      the first and look like nothing happened.
    */
    const index = stickers.length % 6;
    persist(
      addSticker(stickers, {
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
                  Hangs BELOW the toolbar, over the top of the board. It
                  covers cards only while it is open, and closes as soon as a
                  marker is picked.
                */
                <div
                  role="group"
                  aria-label="Pilih penanda"
                  className="absolute right-0 top-full z-50 mt-1 flex w-[232px] flex-wrap gap-1 rounded-lg border border-border bg-surface p-1.5 shadow-lg"
                >
                  {STICKER_EMOJI.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => place(emoji)}
                      aria-label={`Tempel ${emoji}`}
                      className="flex min-h-tap w-10 items-center justify-center rounded text-xl hover:bg-bg-subtle"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}
            </span>,
            actionsSlot,
          )
        : null}

      {stickers.map((sticker) => (
        <div
          key={sticker.id}
          className="group/sticker absolute z-40 select-none"
          style={{
            left: `${String(sticker.x * 100)}%`,
            top: sticker.y,
            touchAction: 'none',
          }}
        >
          <button
            type="button"
            aria-label={`Geser penanda ${sticker.emoji}`}
            onPointerDown={(event) => {
              const surface = surfaceRef.current;
              if (!surface) return;
              const box = surface.getBoundingClientRect();
              offset.current = {
                dx: event.clientX - (box.left + sticker.x * box.width),
                dy: event.clientY - (box.top + sticker.y),
              };
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragId(sticker.id);
            }}
            onPointerMove={(event) => {
              if (dragId !== sticker.id) return;
              const surface = surfaceRef.current;
              if (!surface) return;
              const box = surface.getBoundingClientRect();
              const x = (event.clientX - offset.current.dx - box.left) / Math.max(box.width, 1);
              const y = event.clientY - offset.current.dy - box.top;
              // Moved in state while dragging; written once on release, so a
              // drag across the board is one storage write, not a hundred.
              setStickers((current) => moveSticker(current, sticker.id, x, y));
            }}
            onPointerUp={() => {
              if (dragId !== sticker.id) return;
              setDragId(null);
              persist(stickers);
            }}
            onPointerCancel={() => setDragId(null)}
            /*
              On its own white disc with a dark ring and a real shadow.

              A bare emoji on a card is an emoji on a coloured background, and
              the cards come in twelve colours: a flag on the red card, a tick
              on the green one, simply disappeared into it — a marker nobody
              notices marks nothing. White with a dark ring separates from
              every card colour in both themes, which no single tint could.
            */
            className="flex h-10 w-10 cursor-grab items-center justify-center rounded-full bg-white text-2xl leading-none shadow-[0_2px_8px_rgba(0,0,0,0.45)] ring-2 ring-black/70"
          >
            <span aria-hidden="true">{sticker.emoji}</span>
          </button>

          {/* Removal is deliberate and small: a sticker is easy to place
              again, and a confirmation for one would cost more than the
              mistake. */}
          <button
            type="button"
            onClick={() => persist(removeSticker(stickers, sticker.id))}
            aria-label={`Hapus penanda ${sticker.emoji}`}
            className="absolute -right-2 -top-1 hidden h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-[10px] text-fg-muted group-hover/sticker:flex"
          >
            ×
          </button>
        </div>
      ))}
    </>
  );
}
