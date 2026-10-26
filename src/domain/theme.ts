/**
 * The app's colour modes (26 Oct 2026, Avi: a third theme beside Terang and
 * Gelap that is easy on the eyes while colours stay readable).
 *
 * `senja` is a dark-family theme: it sets the same `dark` class (so every
 * `dark:` utility and the colour scheme apply) plus `data-theme="senja"`, which
 * tokens.css uses to move the values to a softer mid-tone. Stored on this
 * device only, like the accent palette.
 */
export const THEMES = [
  {
    id: 'system',
    name: 'Sistem',
    note: 'Ikut perangkat',
    // Half and half: what the device would pick by day and by night.
    swatch: { bg: '#f3f5f8', surface: '#ffffff', fg: '#0f1a2a', accent: '#1559c7', cards: ['#fee2e2', '#fef9c3', '#dbeafe', '#d1fae5'] },
    swatchNight: { bg: '#0a0f15', surface: '#131a24', fg: '#e8eef5', accent: '#6aa3ff', cards: ['#3b1c1e', '#382f12', '#142944', '#0f3026'] },
  },
  {
    id: 'light',
    name: 'Terang',
    note: 'Siang, ruang terang',
    swatch: { bg: '#f3f5f8', surface: '#ffffff', fg: '#0f1a2a', accent: '#1559c7', cards: ['#fee2e2', '#fef9c3', '#dbeafe', '#d1fae5'] },
  },
  {
    id: 'dark',
    name: 'Gelap',
    note: 'Jaga malam, layar OLED',
    swatch: { bg: '#0a0f15', surface: '#131a24', fg: '#e8eef5', accent: '#6aa3ff', cards: ['#3b1c1e', '#382f12', '#142944', '#0f3026'] },
  },
  {
    id: 'senja',
    name: 'Senja',
    note: 'Lembut di mata, warna tetap jelas',
    swatch: { bg: '#252b3a', surface: '#32394a', fg: '#f3eee4', accent: '#aab9ff', cards: ['#743c38', '#5c4d0f', '#2f5079', '#1d5c3f'] },
  },
] as const;

export type ThemePreference = (typeof THEMES)[number]['id'];

export const THEME_KEY = 'visite.theme';
/** The ground of Senja, for the browser's address bar / status bar colour. */
export const SENJA_BG = '#252b3a';

export const isTheme = (v: unknown): v is ThemePreference => THEMES.some((t) => t.id === v);

/** What the document gets: the `dark` class, and `data-theme="senja"` for Senja only. */
export function resolveTheme(theme: ThemePreference, prefersDark: boolean): { dark: boolean; senja: boolean } {
  const senja = theme === 'senja';
  return { dark: senja || theme === 'dark' || (theme === 'system' && prefersDark), senja };
}
