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

/**
 * Put a mark on patients by itself (13.10, Avi: "apply this colour to every
 * new patient, or NP patients, or YP and AAU patients"). Turned off for one
 * patient by tapping its tag.
 */
export type MarkAuto =
  | { kind: 'baru' }
  | { kind: 'dpjp'; ids: string[] }
  | { kind: 'btkv' }
  | { kind: 'kjs' }
  | { kind: 'divisi' }
  | { kind: 'tanpa-junior' };

export const AUTO_LABEL: Record<MarkAuto['kind'], string> = {
  baru: 'Pasien baru (belum ada di list kemarin)',
  dpjp: 'DPJP tertentu',
  btkv: 'KJS BTKV',
  kjs: 'Konsul / KJS dari DPJP lain',
  divisi: 'Dipegang divisi (tidak di-FU)',
  'tanpa-junior': 'Belum ada junior',
};

export interface FloorMark {
  id: string;
  label: string;
  color: MarkColor;
  auto?: MarkAuto | undefined;
}

/** A tag as shown on a patient. */
export interface PatientTag {
  label: string;
  color: MarkColor;
}

function readAuto(raw: unknown): MarkAuto | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const { kind, ids } = raw as Record<string, unknown>;
  if (kind === 'dpjp') {
    const list = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && id.length > 0) : [];
    return list.length > 0 ? { kind, ids: list } : undefined;
  }
  return kind === 'baru' || kind === 'btkv' || kind === 'kjs' || kind === 'divisi' || kind === 'tanpa-junior' ? { kind } : undefined;
}

/** What an automatic rule looks at. */
export interface AutoFacts {
  isNew: boolean;
  dpjpId: string | null;
  btkv: boolean;
  kjs: boolean;
  division: boolean;
  junior: string;
}

export function autoMatches(auto: MarkAuto | undefined, facts: AutoFacts): boolean {
  if (!auto) return false;
  switch (auto.kind) {
    case 'baru':
      return facts.isNew;
    case 'dpjp':
      return facts.dpjpId !== null && auto.ids.includes(facts.dpjpId);
    case 'btkv':
      return facts.btkv;
    case 'kjs':
      return facts.kjs;
    case 'divisi':
      return facts.division;
    case 'tanpa-junior':
      return !facts.division && !facts.junior;
  }
}

/**
 * The tags on a patient: the floor's marks set by hand (`tags`), or matched
 * by a rule and not turned off for this patient (`tagsOff`). In the floor's
 * order. A deleted mark shows nothing.
 */
export function tagsOf(marks: readonly FloorMark[], hand: readonly string[], off: readonly string[], facts: AutoFacts): PatientTag[] {
  return marks
    .filter((m) => hand.includes(m.id) || (autoMatches(m.auto, facts) && !off.includes(m.id)))
    .map((m) => ({ label: m.label, color: m.color }));
}

/** 13.7 stored a hand mark as `colour` = "m:<id>"; read as a tag since 13.10. */
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
    const auto = readAuto((entry as Record<string, unknown>).auto);
    out.push({ id, label: label.trim(), color, ...(auto ? { auto } : {}) });
  }
  return out;
}

/** A new id that is not taken (short: it is stored on every marked patient). */
export function newMarkId(marks: readonly FloorMark[]): string {
  let n = marks.length + 1;
  while (marks.some((m) => m.id === `k${n}`)) n += 1;
  return `k${n}`;
}
