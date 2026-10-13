/**
 * The floor's own colours (13.7, Avi: "add more customizable color option").
 *
 * Red (H-1) and green (pulang hari ini) are fixed: everybody reads them the
 * same way on the printed list. Anything else the floor wants to see at a
 * glance — "pre-op", "tunggu ICU", "konsul" — is a MARK the floor defines once
 * (a label and a colour) and anyone sets on a patient like red/green.
 *
 * The colour is picked from a fixed palette, never a free hex: each entry has
 * a light and a dark value that clear 4.5:1 as text (tokens.css,
 * `--mark-*`, checked by scripts/check-contrast.mjs) and a Word colour, so a
 * mark looks the same on screen, in dark mode and on paper.
 */

export const MARK_COLORS = {
  blue: { name: 'Biru', docx: '0070C0' },
  purple: { name: 'Ungu', docx: '7030A0' },
  orange: { name: 'Oranye', docx: 'ED7D31' },
  pink: { name: 'Merah muda', docx: 'E3007D' },
  teal: { name: 'Toska', docx: '00938A' },
  brown: { name: 'Cokelat', docx: '996633' },
  grey: { name: 'Abu-abu', docx: '7F7F7F' },
} as const;

export type MarkColor = keyof typeof MARK_COLORS;

export interface FloorMark {
  id: string;
  label: string;
  color: MarkColor;
}

/** A floor mark as set on a patient: `colour` = "m:<id>". */
export const MARK_PREFIX = 'm:';

export const isMarkColor = (value: unknown): value is MarkColor => typeof value === 'string' && Object.hasOwn(MARK_COLORS, value);

/** The CSS colour of a mark (follows light/dark mode). */
export const markCss = (color: MarkColor): string => `var(--mark-${color})`;

/** Marks as stored, cleaned: unknown colours and empty labels dropped, ids unique. */
export function readMarks(raw: unknown): FloorMark[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: FloorMark[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const { id, label, color } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || !id || seen.has(id) || typeof label !== 'string' || !label.trim() || !isMarkColor(color)) continue;
    seen.add(id);
    out.push({ id, label: label.trim(), color });
  }
  return out;
}

/** The mark a patient's `colour` names, if the floor still has it. */
export function markOf(colour: string, marks: readonly FloorMark[]): FloorMark | null {
  if (!colour.startsWith(MARK_PREFIX)) return null;
  const id = colour.slice(MARK_PREFIX.length);
  return marks.find((m) => m.id === id) ?? null;
}

/** A new id that is not taken (short: it is stored on every marked patient). */
export function newMarkId(marks: readonly FloorMark[]): string {
  let n = marks.length + 1;
  while (marks.some((m) => m.id === `k${n}`)) n += 1;
  return `k${n}`;
}
