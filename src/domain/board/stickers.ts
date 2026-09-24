/**
 * Emoji stickers on the canvas board.
 *
 * A mark put NEXT TO a patient card — a flag, a tick, a cross — to say
 * something about that patient for the next hour. It is not a field on the
 * patient: what it means lives in the head of whoever put it there, it is
 * true until they move it, and nothing else in the app should read it.
 *
 * WHY PER DEVICE
 *
 * A sticker means something by WHERE it is, and where a card is on the canvas
 * is already per device (`readLayouts`/`writeLayouts`). Syncing the stickers
 * while the cards stay local would put a flag beside a different patient on
 * the phone — worse than not syncing it at all. So stickers live beside the
 * layout they point into, in localStorage, and move with it or not at all.
 *
 * Coordinates match the canvas layout's: `x` a fraction of the canvas width,
 * `y` in pixels. A window resized to half the width keeps the sticker beside
 * the same card, which is the entire point of it.
 *
 * WHY PER SCOPE
 *
 * The board has two scopes over the same canvas, Pasien saya and Titipan, and
 * they show different cards at the same (x, y). A sticker stored once was
 * drawn in both — a flag placed next to a patient in one scope appeared next
 * to whatever card happened to sit there in the other, which is a mark on the
 * wrong patient. Storage is keyed by scope, the same fix `readLayouts` would
 * need if two scopes ever showed different card sets at the same position.
 */

export interface BoardSticker {
  id: string;
  emoji: string;
  /** 0–1, fraction of the canvas width. */
  x: number;
  /** Pixels from the top of the canvas. */
  y: number;
}

/**
 * The palette, grouped by what a ward round marks. Each has a LABEL, shown as
 * the tooltip and read by a screen reader — "🚗" alone does not say "pulang",
 * and the whole point of a marker is that its meaning is shared.
 *
 * Still a fixed set rather than any emoji: a picker of two hundred is a
 * decision every time it opens.
 */
export const STICKER_GROUPS: ReadonlyArray<{
  title: string;
  stickers: ReadonlyArray<{ emoji: string; label: string }>;
}> = [
  {
    title: 'Status',
    stickers: [
      { emoji: '🚩', label: 'Tandai' },
      { emoji: '✅', label: 'Selesai' },
      { emoji: '❌', label: 'Batal' },
      { emoji: '⭐', label: 'Penting' },
      { emoji: '⚠️', label: 'Waspada' },
      { emoji: '❗', label: 'Segera' },
      { emoji: '❓', label: 'Perlu ditanyakan' },
    ],
  },
  {
    title: 'Menunggu',
    stickers: [
      { emoji: '🕒', label: 'Tunggu jam' },
      { emoji: '⏳', label: 'Menunggu hasil' },
      { emoji: '📞', label: 'Telepon' },
      { emoji: '🔔', label: 'Ingatkan' },
      { emoji: '📝', label: 'Catat' },
    ],
  },
  {
    title: 'Klinis',
    stickers: [
      { emoji: '🩸', label: 'Darah / transfusi' },
      { emoji: '🧪', label: 'Lab' },
      { emoji: '💉', label: 'Injeksi' },
      { emoji: '💊', label: 'Obat' },
      { emoji: '🩺', label: 'Periksa ulang' },
      { emoji: '🫀', label: 'Jantung' },
      { emoji: '🫁', label: 'Paru' },
      { emoji: '🧠', label: 'Neuro' },
      { emoji: '🍽️', label: 'Makan / puasa' },
    ],
  },
  {
    title: 'Disposisi',
    stickers: [
      { emoji: '🚗', label: 'Pulang' },
      { emoji: '🏠', label: 'Rawat jalan' },
      { emoji: '🚑', label: 'Rujuk / transfer' },
      { emoji: '🏥', label: 'Pindah ruangan' },
      { emoji: '✂️', label: 'Tindakan / operasi' },
      { emoji: '🛏️', label: 'Tirah baring' },
    ],
  },
  {
    title: 'Warna',
    stickers: [
      { emoji: '🔴', label: 'Merah' },
      { emoji: '🟠', label: 'Oranye' },
      { emoji: '🟡', label: 'Kuning' },
      { emoji: '🟢', label: 'Hijau' },
      { emoji: '🔵', label: 'Biru' },
      { emoji: '🟣', label: 'Ungu' },
    ],
  },
];

/** Flat, for lookups. */
export const STICKER_EMOJI: readonly string[] = STICKER_GROUPS.flatMap((group) =>
  group.stickers.map((sticker) => sticker.emoji),
);

export function stickerLabel(emoji: string): string {
  for (const group of STICKER_GROUPS) {
    const found = group.stickers.find((sticker) => sticker.emoji === emoji);
    if (found) return found.label;
  }
  return emoji;
}

/**
 * A small, stable tilt per sticker, -8° to 8°, from its id.
 *
 * Stickers are slapped on, not aligned; a row of perfectly upright ones reads
 * as icons in a toolbar. Derived from the id, so a sticker keeps its angle
 * across reloads instead of jittering each time the board draws.
 */
export function stickerTilt(id: string): number {
  let sum = 0;
  for (const char of id) sum = (sum * 31 + char.charCodeAt(0)) % 1000;
  return (sum % 17) - 8;
}

const STICKER_KEY_PREFIX = 'visite.board.stickers';
/** Where every scope stored its stickers before this release. Migrated once. */
export const LEGACY_STICKER_KEY = STICKER_KEY_PREFIX;

/** `scope` is the board's own scope id ('mine' | 'temporary'), not a free string. */
export function stickerStorageKey(scope: string): string {
  return `${STICKER_KEY_PREFIX}.${scope}`;
}

export function parseStickers(raw: string | null): BoardSticker[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (typeof entry !== 'object' || entry === null) return [];
      const { id, emoji, x, y } = entry as Partial<BoardSticker>;
      if (typeof id !== 'string' || typeof emoji !== 'string') return [];
      if (typeof x !== 'number' || typeof y !== 'number') return [];
      if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
      return [{ id, emoji, x: clampX(x), y: Math.max(0, y) }];
    });
  } catch {
    // A corrupt entry costs the stickers, never the board.
    return [];
  }
}

/** Kept inside the canvas horizontally; a sticker dragged off it is gone. */
export function clampX(x: number): number {
  return Math.min(Math.max(x, 0), 0.97);
}

export function moveSticker(
  stickers: readonly BoardSticker[],
  id: string,
  x: number,
  y: number,
): BoardSticker[] {
  return stickers.map((sticker) =>
    sticker.id === id ? { ...sticker, x: clampX(x), y: Math.max(0, y) } : sticker,
  );
}

export function addSticker(
  stickers: readonly BoardSticker[],
  sticker: BoardSticker,
): BoardSticker[] {
  return [...stickers, { ...sticker, x: clampX(sticker.x), y: Math.max(0, sticker.y) }];
}

export function removeSticker(stickers: readonly BoardSticker[], id: string): BoardSticker[] {
  return stickers.filter((sticker) => sticker.id !== id);
}

/**
 * What to do when a scope's own storage is empty: read fresh (no stored key
 * at all, or an empty array — genuinely nothing has been placed yet) or run
 * the one-time migration from the pre-scope key (`'mine'` only, and only when
 * that legacy key still has something in it).
 *
 * Pure, so the decision is tested without a DOM or localStorage.
 */
export function stickerMigrationPlan(
  scope: string,
  scopeStorageValue: string | null,
  legacyStorageValue: string | null,
): 'use-scope' | 'migrate-legacy' | 'fresh' {
  if (scopeStorageValue !== null) return 'use-scope';
  if (scope === 'mine' && legacyStorageValue !== null) return 'migrate-legacy';
  return 'fresh';
}
