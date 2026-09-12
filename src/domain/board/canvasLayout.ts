/**
 * Free-canvas positions for the board, and the coordinate system they live in.
 *
 * WHY x AND w ARE FRACTIONS AND y IS PIXELS
 *
 * A card remembered at `x: 640px` is in a different place on every screen — a
 * layout arranged on the ward PC would be scattered on a laptop and off the
 * edge on a tablet. Storing x as a FRACTION of the canvas width (0–1) makes a
 * card "40% across", which is the thing the arrangement actually means, and it
 * survives a window resize without anything having to re-run.
 *
 * The vertical axis is not like that. The canvas scrolls, so there is no
 * height to be a fraction of, and the distance between two stacked cards is a
 * real distance rather than a proportion — scaling it with the viewport would
 * make a tidy column drift apart on a tall monitor. So y is pixels.
 *
 * WHY THIS IS NOT IN FIRESTORE
 *
 * Same reasoning already recorded for `customIds`: an arrangement is a view
 * preference, not a fact about the patient, and keeping it out of the document
 * means dragging a card writes nothing to the server and cannot conflict with
 * another device mid-round. The cost is the same too — a layout built on one
 * machine is not the layout on another. If that turns out to be the wrong side
 * of the trade, only `readLayouts`/`writeLayouts` change.
 */

export interface CardLayout {
  /** Left edge, as a fraction of canvas width. */
  x: number;
  /** Top edge, in pixels from the top of the canvas. */
  y: number;
  /** Width, as a fraction of canvas width. Clamped to MIN_CARD_PX at render. */
  w: number;
  /**
   * Maximum height in pixels, or 0 for "as tall as the content".
   *
   * Stage 2. Stored now so the shape does not change under a layout somebody
   * has already arranged — a migration of positions is a migration of work
   * the user did by hand.
   */
  hMax: number;
}

export type CanvasLayouts = Record<string, CardLayout>;

const KEY = 'visite.boardCanvasLayout';

/** Below this a card is unreadable, whatever fraction says. */
export const MIN_CARD_PX = 240;
/**
 * Shortest a height cap may be.
 *
 * Not an aesthetic floor — it is roughly the card header plus one line, which
 * is the point below which a capped card no longer says which patient it is.
 * A card you cannot identify is worse than no card, because it still occupies
 * the position where you expect to find them.
 */
export const MIN_CARD_H = 120;
/** Default footprint for a card nobody has placed yet. */
export const DEFAULT_W = 0.24;
/** Vertical step for auto-placement, and the assumed height of a placed card. */
export const ROW_STEP = 260;
export const GAP_PX = 12;

export function readLayouts(): CanvasLayouts {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return {};

    // Validated field by field rather than cast. This is the one input to the
    // board that comes from outside the app's own writes — an older build, a
    // half-finished write, someone's devtools — and a NaN in `x` positions a
    // card nowhere and takes the whole board's layout with it.
    const out: CanvasLayouts = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const entry = value as Record<string, unknown>;
      const x = Number(entry.x);
      const y = Number(entry.y);
      const w = Number(entry.w);
      const hMax = Number(entry.hMax ?? 0);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w)) continue;
      out[id] = {
        x: clamp(x, 0, 0.98),
        y: Math.max(0, y),
        w: clamp(w, 0.08, 1),
        hMax: Number.isFinite(hMax) ? Math.max(0, hMax) : 0,
      };
    }
    return out;
  } catch {
    return {};
  }
}

export function writeLayouts(layouts: CanvasLayouts): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(layouts));
  } catch (error) {
    console.warn('[board] canvas layout not saved', error);
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Give every card a position, placing the ones nobody has moved yet.
 *
 * An unplaced card is a NEW PATIENT — admitted since the last time the board
 * was arranged — and the failure to avoid is it appearing underneath one that
 * was placed by hand, where it is invisible and looks like it was never
 * created. So auto-placement walks the default grid and skips any slot whose
 * box overlaps something already positioned.
 *
 * Overlap between two cards the USER placed is left alone. That is what a free
 * canvas is; pushing them apart would mean the board rearranging itself after
 * a deliberate act, which is the behaviour "urutan sendiri" exists to escape.
 *
 * Auto-placement is NOT written to storage. A card that has never been dragged
 * has no remembered position, so it re-flows as the board changes instead of
 * freezing wherever it first happened to land.
 */
export function placeAll(
  ids: readonly string[],
  stored: CanvasLayouts,
  columns: number,
): CanvasLayouts {
  const resolved: CanvasLayouts = {};
  const taken: Array<{ x: number; y: number; w: number }> = [];

  for (const id of ids) {
    const layout = stored[id];
    if (layout) {
      resolved[id] = layout;
      taken.push({ x: layout.x, y: layout.y, w: layout.w });
    }
  }

  const width = 1 / columns;
  let slot = 0;

  for (const id of ids) {
    if (resolved[id]) continue;

    // Walk slots until one is free. Bounded so a board whose placed cards
    // happen to cover the first screens still terminates somewhere visible
    // rather than looping.
    let candidate: CardLayout | null = null;
    for (let guard = 0; guard < ids.length * 4 + 40; guard += 1) {
      const column = slot % columns;
      const row = Math.floor(slot / columns);
      const box = { x: column * width, y: row * ROW_STEP, w: width };
      slot += 1;
      if (!taken.some((other) => overlaps(box, other))) {
        candidate = { x: box.x, y: box.y, w: width, hMax: 0 };
        break;
      }
    }

    const placed = candidate ?? { x: 0, y: (ids.length + 1) * ROW_STEP, w: width, hMax: 0 };
    resolved[id] = placed;
    taken.push({ x: placed.x, y: placed.y, w: placed.w });
  }

  return resolved;
}

/**
 * Box overlap, with the vertical extent ASSUMED rather than measured.
 *
 * Real card heights are only known after render, and auto-placement has to
 * decide before that. `ROW_STEP` is the assumption, and it errs tall: treating
 * a card as taller than it is costs an empty slot, while treating it as
 * shorter puts a new patient on top of an existing one — the failure this
 * whole function exists to prevent.
 */
function overlaps(
  a: { x: number; y: number; w: number },
  b: { x: number; y: number; w: number },
): boolean {
  const horizontal = a.x < b.x + b.w && b.x < a.x + a.w;
  const vertical = a.y < b.y + ROW_STEP && b.y < a.y + ROW_STEP;
  return horizontal && vertical;
}

/** How many default-width columns fit a canvas this wide. */
export function columnsFor(widthPx: number): number {
  return clamp(Math.floor(widthPx / (MIN_CARD_PX + GAP_PX)), 1, 6);
}

export type GestureMode = 'move' | 'width' | 'height';

/**
 * What a pointer delta does to a card's layout.
 *
 * Pulled out of the component and made pure so it can be tested, because this
 * is where the arithmetic that is easy to get quietly wrong lives: the clamp
 * that keeps a card on the canvas, the minimum width, and the rule that turns
 * an over-dragged height cap into no cap at all. None of those are visible in
 * a screenshot — a card that ends up one pixel off-canvas looks fine until the
 * day it is the card you needed.
 */
export function applyGesture(
  mode: GestureMode,
  origin: CardLayout,
  input: {
    dx: number;
    dy: number;
    canvasWidth: number;
    natural: number;
    /**
     * The shortest and tallest heights this card can usefully be, MEASURED
     * from the rendered card rather than guessed.
     *
     * `minH` is the card with its diagnosis list fully collapsed — name, bed,
     * badges, progress strip and note, and nothing else. Below that the parts
     * that identify the patient start overlapping each other, which is what a
     * fixed 120 px floor produced.
     *
     * `maxH` is the card with every line of the note shown. Past it the drag
     * buys nothing but empty space, so it stops.
     *
     * Both come from the card's own layout — the chrome it cannot give up, and
     * the middle block's `scrollHeight`, which is the full content height and
     * is NOT affected by the cap. That independence is what the removed uncap
     * rule lacked.
     */
    minH?: number;
    maxH?: number;
  },
): CardLayout {
  const { dx, dy, canvasWidth, natural } = input;
  const minH = Math.max(MIN_CARD_H, input.minH ?? MIN_CARD_H);
  const maxH = Math.max(minH, input.maxH ?? Number.POSITIVE_INFINITY);

  if (mode === 'move') {
    return {
      ...origin,
      // Clamped by the card's own width, so it can never be dragged entirely
      // off the right edge and lost.
      x: clamp(origin.x + dx / canvasWidth, 0, Math.max(0, 1 - origin.w)),
      y: Math.max(0, origin.y + dy),
    };
  }

  if (mode === 'width') {
    const minimum = MIN_CARD_PX / canvasWidth;
    return {
      ...origin,
      w: clamp(origin.w + dx / canvasWidth, minimum, Math.max(minimum, 1 - origin.x)),
    };
  }

  /*
    THE HEIGHT FOLLOWS THE POINTER. There is no threshold and nothing snaps.

    What was here before tried to be clever: drag past the end of the content
    and the cap was REMOVED rather than set to a large number, on the reasoning
    that `hMax: 900` on a 400-tall card behaves like no cap until the note
    grows. The reasoning is sound and the implementation could not work,
    because the number it compared against was unmeasurable.

    `natural` came from the card's `scrollHeight`. But a capped card is
    rendered with `fitHeight`, which makes it a flex column that COMPRESSES to
    the height it is given — so it never overflows, and its `scrollHeight` is
    always exactly the cap. `natural === origin.hMax`, every time. The test
    `target >= natural - 8` therefore reduced to `dy >= -8`: any downward
    movement uncapped the card and it jumped to full height, and eight pixels
    back up re-capped it. That is the flicker in the recording — not a snap to
    a grid, a binary flipping under the finger.

    A rule whose input is determined by its own output cannot be fixed by
    tuning the threshold. It is removed. The cap is now exactly where the
    pointer left it, and "no cap" is an explicit act: double-click the grip.
  */
  return {
    ...origin,
    // `natural` is still the honest starting point when the card has no cap
    // yet — there `fitHeight` is off, nothing is compressed, and
    // `scrollHeight` really is the content height. So the first drag begins
    // from where the card currently ends rather than from a guess.
    // Clamped between the two measured ends. Not auto-uncapped at the top:
    // dropping the cap would switch the card out of its fixed-height layout
    // mid-gesture, which changes the very measurements this is clamped by —
    // the shape of the bug that made it flicker. Uncapping stays a
    // double-click, where nothing is moving.
    hMax: clamp((origin.hMax || natural || minH) + dy, minH, maxH),
  };
}

/**
 * Reflow every card into a tidy grid, keeping the arrangement's reading order.
 *
 * WHY THIS IS A BUTTON AND NOT A RULE
 *
 * A free canvas cannot close its own gaps. Discharge a patient from the middle
 * of an arranged board and the hole stays, because the alternative — cards
 * sliding up on their own — is the board rearranging itself after a deliberate
 * act, which is the exact behaviour `Urutan sendiri` exists to escape. So the
 * hole is real, and the answer is a press, at a moment the user chose.
 *
 * WHY IT SORTS BY POSITION RATHER THAN BY BOARD ORDER
 *
 * Tidying by the underlying list order would throw the arrangement away and
 * call it cleaning. Reading order — top to bottom, left to right within a band
 * — is what the user built by hand; tidying should close the gaps in it, not
 * replace it. The band tolerance exists because two cards side by side are
 * never at exactly the same y, and sorting on raw y would interleave columns
 * that the eye reads as one row.
 *
 * Widths and height caps are carried through untouched. They were set
 * deliberately and are not what "tidy" means.
 */
export function tidy(
  ids: readonly string[],
  layouts: CanvasLayouts,
  columns: number,
): CanvasLayouts {
  const band = ROW_STEP / 2;
  const ordered = [...ids]
    .filter((id) => layouts[id])
    .sort((left, right) => {
      const a = layouts[left] as CardLayout;
      const b = layouts[right] as CardLayout;
      const rowA = Math.round(a.y / band);
      const rowB = Math.round(b.y / band);
      return rowA === rowB ? a.x - b.x : rowA - rowB;
    });

  const next: CanvasLayouts = {};
  const defaultWidth = 1 / columns;
  let cursorX = 0;
  let shelfY = 0;
  let shelfHeight = 0;

  for (const id of ordered) {
    const layout = layouts[id] as CardLayout;
    const width = clamp(layout.w || defaultWidth, 0.08, 1);

    // Wrap before placing, not after: a card that would hang off the right
    // edge starts the next shelf instead of being clipped there. The `> 0`
    // guard stops a single card wider than the canvas from wrapping forever
    // onto empty shelves.
    if (cursorX > 0 && cursorX + width > 1.0001) {
      shelfY += shelfHeight;
      shelfHeight = 0;
      cursorX = 0;
    }

    next[id] = { ...layout, x: cursorX, y: shelfY, w: width };
    cursorX += width;
    shelfHeight = Math.max(shelfHeight, (layout.hMax || ROW_STEP) + GAP_PX);
  }

  return next;
}
