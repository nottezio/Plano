/**
 * Three optional looks for the whole app (4 Nov 2026, Avi: "so crowded"),
 * chosen in Pengaturan → Tema and stored on the profile. Each is optional on
 * `UserSettings`; absent or unknown reads as the default, so an older profile
 * or a newer build can never break the screen.
 *
 * They only move CSS variables and attributes on <html> (see `applyAppearance`
 * and the `[data-density]`, `[data-text-size]`, `[data-card-style]` blocks in
 * styles/index.css). Nothing here touches stored text or card colour tokens.
 */

export type Density = 'kompak' | 'normal' | 'longgar';
export type TextSize = 'kecil' | 'normal' | 'besar';
export type CardStyle = 'pastel' | 'netral' | 'garis';

export const DEFAULT_DENSITY: Density = 'normal';
export const DEFAULT_TEXT_SIZE: TextSize = 'normal';
export const DEFAULT_CARD_STYLE: CardStyle = 'pastel';

export const DENSITIES: ReadonlyArray<{ id: Density; label: string; hint: string }> = [
  { id: 'kompak', label: 'Kompak', hint: 'Lebih banyak pasien per layar' },
  { id: 'normal', label: 'Normal', hint: 'Seperti sebelumnya' },
  { id: 'longgar', label: 'Longgar', hint: 'Jarak lebih lega' },
];

export const TEXT_SIZES: ReadonlyArray<{ id: TextSize; label: string; hint: string }> = [
  { id: 'kecil', label: 'Kecil', hint: 'Teks catatan sekitar 14 px' },
  { id: 'normal', label: 'Normal', hint: 'Teks catatan 15 px, seperti sebelumnya' },
  { id: 'besar', label: 'Besar', hint: 'Teks catatan sekitar 17 px' },
];

export const CARD_STYLES: ReadonlyArray<{ id: CardStyle; label: string; hint: string }> = [
  { id: 'pastel', label: 'Pastel', hint: 'Kartu berwarna sesuai checklist, seperti sebelumnya' },
  { id: 'netral', label: 'Netral', hint: 'Kartu putih; warna hanya di chip status' },
  { id: 'garis', label: 'Garis tepi', hint: 'Kartu putih dengan garis tepi berwarna' },
];

const pick = <T extends string>(list: ReadonlyArray<{ id: T }>, value: unknown, fallback: T): T =>
  list.some((entry) => entry.id === value) ? (value as T) : fallback;

export const densityOf = (value: unknown): Density => pick(DENSITIES, value, DEFAULT_DENSITY);
export const textSizeOf = (value: unknown): TextSize => pick(TEXT_SIZES, value, DEFAULT_TEXT_SIZE);
export const cardStyleOf = (value: unknown): CardStyle => pick(CARD_STYLES, value, DEFAULT_CARD_STYLE);

/** Writes the three choices onto <html>; the stylesheet does the rest. */
export function applyAppearance(
  settings: { density?: unknown; textSize?: unknown; cardStyle?: unknown },
  root: Pick<HTMLElement, 'setAttribute'> = document.documentElement,
): void {
  root.setAttribute('data-density', densityOf(settings.density));
  root.setAttribute('data-text-size', textSizeOf(settings.textSize));
  root.setAttribute('data-card-style', cardStyleOf(settings.cardStyle));
}
