/**
 * Colour palettes for the whole app (13.15, Avi: "more themes, like a colour
 * palette"). The accent family (buttons, selection, links) and, separately,
 * the background: warm paper for daytime, true black for night shifts on an
 * OLED phone. Values live in styles/tokens.css; this is the list and the
 * attribute names. Stored on this device only.
 */
export const PALETTES = [
  { id: 'biru', name: 'Biru', swatch: ['#0b5ed7', '#5b9cff'] },
  { id: 'toska', name: 'Toska', swatch: ['#0f766e', '#2dd4bf'] },
  { id: 'ungu', name: 'Ungu', swatch: ['#6d28d9', '#a78bfa'] },
  { id: 'hijau', name: 'Hijau', swatch: ['#15803d', '#4ade80'] },
  { id: 'oranye', name: 'Oranye', swatch: ['#c2410c', '#fb923c'] },
  { id: 'rose', name: 'Merah muda', swatch: ['#be123c', '#fb7185'] },
  { id: 'grafit', name: 'Grafit', swatch: ['#334155', '#cbd5e1'] },
] as const;

export type PaletteId = (typeof PALETTES)[number]['id'];

export const SURFACES = [
  { id: 'standar', name: 'Standar', note: 'Putih / abu gelap' },
  { id: 'hangat', name: 'Kertas hangat', note: 'Mode terang' },
  { id: 'pekat', name: 'Hitam pekat', note: 'Mode gelap, layar OLED' },
] as const;

export type SurfaceId = (typeof SURFACES)[number]['id'];

export const PALETTE_KEY = 'plano.palette';
export const SURFACE_KEY = 'plano.surface';

export const isPalette = (v: unknown): v is PaletteId => PALETTES.some((p) => p.id === v);
export const isSurface = (v: unknown): v is SurfaceId => SURFACES.some((s) => s.id === v);

export function applyPalette(palette: PaletteId, surface: SurfaceId): void {
  const root = document.documentElement;
  root.setAttribute('data-palette', palette);
  root.setAttribute('data-surface', surface);
}
