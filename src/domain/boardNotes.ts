/**
 * Sticky notes on the patient board.
 *
 * A note that lives BESIDE the patient cards — "lab jam 14", "konfirmasi OK
 * besok" — stuck where it is needed and moved when it is not. It is not a
 * Catatan: those are documents with a page of their own. A sticky note is a
 * few lines, edited where it sits, and never opened anywhere else.
 *
 * STORAGE
 *
 * On the user's profile, as a MAP keyed by note id, and every change is written
 * to one field path (`boardNotes.<id>.text`). Not an array: Catatan are one
 * array in one document, and two quick saves there lost the first — recurring
 * pattern 5, which needed `pendingBodies` to fix. A map written a field at a
 * time cannot lose one note's edit to another's, because the two writes never
 * touch the same field.
 *
 * Position and size are NOT stored here. They belong to the canvas layout,
 * exactly like a patient card's, so a sticky note is placed, dragged and
 * resized by the same code, and a fix to one is a fix to both.
 */

export type StickyColor = 'kuning' | 'oranye' | 'merah' | 'hijau' | 'biru' | 'ungu';

/**
 * Colours are the shared card tokens, so they follow the theme and pass
 * `check:contrast`. Yellow first: it is what a sticky note looks like, and
 * the default should look like the thing it is.
 */
export const STICKY_COLORS: ReadonlyArray<{ id: StickyColor; label: string; step: number }> = [
  { id: 'kuning', label: 'Kuning', step: 3 },
  { id: 'oranye', label: 'Oranye', step: 2 },
  { id: 'merah', label: 'Merah muda', step: 8 },
  { id: 'hijau', label: 'Hijau', step: 4 },
  { id: 'biru', label: 'Biru', step: 6 },
  { id: 'ungu', label: 'Ungu', step: 7 },
];

export interface BoardNote {
  text: string;
  color: StickyColor;
  /** Epoch ms, set by the creating device. Orders new notes; nothing else. */
  createdAt: number;
  /** Ids of attached images, in the order they were added. See `boardImages`. */
  images?: string[];
  /**
   * Soft delete, as everywhere else in this app: no client ever hard-deletes.
   * A deleted note leaves the board and its text stays recoverable.
   */
  deletedAt?: number;
}

export type BoardNotes = Record<string, BoardNote>;

/**
 * Canvas ids are shared between patient cards and sticky notes, so a note's
 * id is prefixed. The prefix is what the board reads to decide which of the
 * two to render; a patient id can never start with it because patient ids
 * are generated without a colon.
 */
export const STICKY_PREFIX = 'sticky:';

export const stickyCanvasId = (noteId: string): string => `${STICKY_PREFIX}${noteId}`;

export const noteIdFromCanvasId = (canvasId: string): string | null =>
  canvasId.startsWith(STICKY_PREFIX) ? canvasId.slice(STICKY_PREFIX.length) : null;

export function stickyTone(color: StickyColor): { bg: string; fg: string } {
  const step = STICKY_COLORS.find((entry) => entry.id === color)?.step ?? 3;
  return { bg: `var(--card-step-${step}-bg)`, fg: `var(--card-step-${step}-fg)` };
}

/**
 * The notes on the board: not deleted, oldest first.
 *
 * Oldest first so a new note is placed AFTER the existing ones by the canvas's
 * auto-placement, instead of pushing everything the user arranged down a slot.
 *
 * Defensive about shape: this map arrives from Firestore, where an older
 * client or a half-applied write could leave an entry without a field, and a
 * board that crashes on one bad note loses every patient card with it.
 */
export function activeBoardNotes(
  notes: BoardNotes | undefined,
): Array<{ id: string; note: BoardNote }> {
  return Object.entries(notes ?? {})
    .filter(([, note]) => note && typeof note === 'object' && note.deletedAt === undefined)
    .map(([id, note]) => ({
      id,
      note: {
        text: typeof note.text === 'string' ? note.text : '',
        color: STICKY_COLORS.some((entry) => entry.id === note.color) ? note.color : 'kuning',
        createdAt: typeof note.createdAt === 'number' ? note.createdAt : 0,
        images: Array.isArray(note.images)
          ? note.images.filter((image): image is string => typeof image === 'string')
          : [],
      },
    }))
    .sort((a, b) => a.note.createdAt - b.note.createdAt || a.id.localeCompare(b.id));
}
