/**
 * The canvas board's background (3 Nov 2026, Avi: "all of them selectable like
 * the sticky note"). Only the free canvas (Urutan sendiri) draws it; the list
 * views keep the plain page. Chosen in Pengaturan → Tema → Latar kanvas and
 * stored as `settings.canvasBackground`; absent or unknown reads as the default,
 * so an older profile or a newer build can never break the board.
 *
 * - `titik`  — a faint dot grid (the default): says "draggable", no glare.
 * - `polos`  — the flat page colour, as before.
 * - `papan`  — a slate board with a faint grid (a white board in the light theme).
 * - `gabus`  — cork.
 * - `vinyet` — flat, a little lighter in the middle.
 * - `denah`  — faint room outlines and a nurse-station strip, unlabelled.
 */
export type CanvasBackground = 'titik' | 'polos' | 'papan' | 'gabus' | 'vinyet' | 'denah';

export const DEFAULT_CANVAS_BACKGROUND: CanvasBackground = 'titik';

export const CANVAS_BACKGROUNDS: ReadonlyArray<{ id: CanvasBackground; label: string; hint: string }> = [
  { id: 'titik', label: 'Titik', hint: 'Kisi titik halus' },
  { id: 'polos', label: 'Polos', hint: 'Warna halaman, seperti sebelumnya' },
  { id: 'papan', label: 'Papan tulis', hint: 'Papan dengan kisi tipis' },
  { id: 'gabus', label: 'Gabus', hint: 'Papan gabus' },
  { id: 'vinyet', label: 'Vinyet lembut', hint: 'Tengah sedikit lebih terang' },
  { id: 'denah', label: 'Denah ruangan', hint: 'Kotak kamar samar, tanpa tulisan' },
];

export function canvasBackgroundOf(value: unknown): CanvasBackground {
  return CANVAS_BACKGROUNDS.some((entry) => entry.id === value) ? (value as CanvasBackground) : DEFAULT_CANVAS_BACKGROUND;
}
