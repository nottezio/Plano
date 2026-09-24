import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  LEGACY_STICKER_KEY as LEGACY_KEY,
  STICKER_GROUPS,
  stickerMigrationPlan,
  stickerLabel,
  stickerStorageKey,
  stickerTilt,
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
  scope,
}: {
  /** The canvas surface, for turning a pointer position into a position on it. */
  surfaceRef: React.RefObject<HTMLDivElement>;
  enabled: boolean;
  /**
   * Which board scope this is (Pasien saya / Titipan). Stickers are stored
   * per scope, because the two show different cards at the same position —
   * see the header of `domain/board/stickers`.
   */
  scope: string;
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
      const key = stickerStorageKey(scope);
      const scopeValue = localStorage.getItem(key);
      const legacyValue = localStorage.getItem(LEGACY_KEY);

      /*
        A one-time migration, 'mine' only. Before this release every scope
        read one shared, unscoped key, so whatever is there was placed while
        looking at SOME scope — most often Pasien saya, the default. Moving it
        under `mine` keeps it findable; leaving it where it was would mean it
        quietly stops appearing the moment this ships.
      */
      const plan = stickerMigrationPlan(scope, scopeValue, legacyValue);
      const migrated = plan === 'migrate-legacy' ? parseStickers(legacyValue) : parseStickers(scopeValue);
      setStickers(migrated);
      if (plan === 'migrate-legacy') {
        localStorage.setItem(key, JSON.stringify(migrated));
        localStorage.removeItem(LEGACY_KEY);
      }
    } catch {
      setStickers([]);
    }
    // Switching scope shows a different board; a drag in progress on the one
    // just left belongs to it, not to the one now on screen.
    setDragId(null);
  }, [scope]);

  const persist = (next: BoardSticker[]): void => {
    setStickers(next);
    try {
      localStorage.setItem(stickerStorageKey(scope), JSON.stringify(next));
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
                  className="absolute right-0 top-full z-50 mt-1 max-h-[70vh] w-[288px] space-y-2 overflow-y-auto rounded-lg border border-border bg-surface p-2 shadow-lg"
                >
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
            aria-label={`Geser penanda ${stickerLabel(sticker.emoji)}`}
            title={stickerLabel(sticker.emoji)}
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
              DIE-CUT, like a vinyl sticker: a white border that follows the
              emoji's own outline, then a drop shadow under the whole thing.

              The white disc it replaces solved the right problem — a bare
              emoji vanished into a card of the same colour — the wrong way:
              a circle reads as a button or a badge, not as something stuck on.
              The outline still separates the mark from any card colour in
              either theme, because it is white against the card and the
              shadow lifts it off, but it keeps the shape of the thing.

              Four offset copies of the glyph in white (`drop-shadow` with no
              blur) make the border; one soft dark shadow makes it sit on top.
              The tilt comes from the id, so it is the same on every draw.
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

          {/* Removal is deliberate and small: a sticker is easy to place
              again, and a confirmation for one would cost more than the
              mistake. */}
          <button
            type="button"
            onClick={() => persist(removeSticker(stickers, sticker.id))}
            aria-label={`Hapus penanda ${stickerLabel(sticker.emoji)}`}
            className="absolute -right-2 -top-1 hidden h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-[10px] text-fg-muted group-hover/sticker:flex"
          >
            ×
          </button>
        </div>
      ))}
    </>
  );
}
