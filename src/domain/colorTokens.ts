/**
 * SPEC 9.3 / 15 — a ChecklistItemDef stores `colorToken`, never a hex.
 *
 * This registry is the allow-list. It must stay in sync with the custom
 * properties declared in styles/tokens.css; `assertTokenExists` is the cheap
 * runtime guard used when importing user settings.
 *
 * Twelve steps ship so that any checklist length gets a distinct colour.
 * Nothing anywhere may assume seven.
 */
export interface ColorTokenDef {
  id: string;
  label: string;
}

export const COLOR_TOKENS: readonly ColorTokenDef[] = [
  { id: 'step-1', label: 'Merah' },
  { id: 'step-2', label: 'Oranye' },
  { id: 'step-3', label: 'Kuning' },
  { id: 'step-4', label: 'Hijau muda' },
  { id: 'step-5', label: 'Tosca' },
  { id: 'step-6', label: 'Biru' },
  { id: 'step-7', label: 'Ungu' },
  { id: 'step-8', label: 'Merah muda' },
  { id: 'step-9', label: 'Biru langit' },
  { id: 'step-10', label: 'Abu-abu' },
  { id: 'step-11', label: 'Rose' },
  { id: 'step-12', label: 'Zamrud' },
  { id: 'done', label: 'Selesai' },
] as const;

/** Tokens assignable to a checklist item (everything except the terminal state). */
export const STEP_TOKENS: readonly string[] = COLOR_TOKENS.filter(
  (token) => token.id !== 'done',
).map((token) => token.id);

export const DONE_TOKEN = 'done';

/** Colour for the Nth checklist item (1-based), wrapping past 12. */
export function tokenForIndex(index: number): string {
  const tokens = STEP_TOKENS;
  const safe = ((index - 1) % tokens.length + tokens.length) % tokens.length;
  return tokens[safe] ?? DONE_TOKEN;
}

export function isKnownToken(token: string): boolean {
  return COLOR_TOKENS.some((candidate) => candidate.id === token);
}
