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
  indigo: { name: 'Nila', docx: '4338CA' },
  cyan: { name: 'Sian', docx: '0E7490' },
  fuchsia: { name: 'Fuksia', docx: 'A21CAF' },
  olive: { name: 'Zaitun', docx: '556B10' },
} as const;

/**
 * A hue picked on the colour wheel (11 Nov 2026, Avi): "h<0-359>". Only the hue
 * is free; lightness and chroma come from the theme (`--hue-l`, `--hue-c` in
 * tokens.css), so every hue still clears 4.5:1 in light, dark and Senja
 * (checked by scripts/check-contrast.mjs across the wheel).
 */
export type HueColor = `h${number}`;
export type MarkColor = keyof typeof MARK_COLORS | HueColor;

/** The hue of a wheel colour, or null for a palette colour. */
export function hueOf(color: MarkColor): number | null {
  const m = /^h(\d{1,3})$/.exec(color);
  return m && Number(m[1]) < 360 ? Number(m[1]) : null;
}

export const hueColor = (hue: number): HueColor => `h${((Math.round(hue) % 360) + 360) % 360}`;

/** OKLCH → sRGB hex ("RRGGBB"), clipped to the gamut. */
export function oklchHex(l: number, c: number, hue: number): string {
  const a = c * Math.cos((hue * Math.PI) / 180);
  const b = c * Math.sin((hue * Math.PI) / 180);
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
  return lin
    .map((v) => {
      const x = Math.min(1, Math.max(0, v));
      const g = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
      return Math.round(g * 255).toString(16).padStart(2, '0');
    })
    .join('')
    .toUpperCase();
}

/** Paper is the light theme: the same lightness and chroma as `--hue-l` / `--hue-c` in :root. */
export const PRINT_HUE = { l: 0.5, c: 0.14 } as const;

/** Name and Word colour of any mark colour, palette or wheel. */
export function markInfo(color: MarkColor): { name: string; docx: string } {
  const hue = hueOf(color);
  if (hue === null) return MARK_COLORS[color as keyof typeof MARK_COLORS];
  return { name: `Warna ${hue}°`, docx: oklchHex(PRINT_HUE.l, PRINT_HUE.c, hue) };
}

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

/**
 * "baru" is retired (10 Nov 2026, Avi): Pasien baru is a badge of its own
 * (`NewBadge`), not a mark. A stored "baru" rule still reads, so the badge can
 * take its label and colour, but never matches.
 */
export const AUTO_LABEL: Record<MarkAuto['kind'], string> = {
  baru: 'Pasien baru (kini lencana sendiri)',
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
  /**
   * false: on screen only, never printed (13.12, Avi: a working mark like
   * "SOAP sudah update" must not appear in the Word sent to consultants).
   */
  print?: false | undefined;
  /**
   * true: a patient with this tag is not followed up by the ward, so Ganti
   * chief never offers it (9 Nov 2026, Avi: titipan, or chosen DPJPs).
   */
  noFollowUp?: true | undefined;
}

/** A tag as shown on a patient. */
export interface PatientTag {
  label: string;
  color: MarkColor;
  /** false: screen only (not in Word/PDF). */
  print?: false | undefined;
  /** From a "tidak di-follow up" mark. */
  noFollowUp?: true | undefined;
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
      // Retired: the Pasien baru badge shows it instead (a mark would show it twice).
      return false;
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
    .map((m) => ({
      label: m.label,
      color: m.color,
      ...(screenOnly(m) ? { print: false as const } : {}),
      ...(m.noFollowUp ? { noFollowUp: true as const } : {}),
    }));
}

/** Off paper: set so by the floor, or "Pasien baru", a working tag for the list maker only (8 Nov 2026, Avi). */
export const screenOnly = (mark: FloorMark): boolean => mark.print === false || mark.auto?.kind === 'baru';

/**
 * The "Pasien baru" badge (10 Nov 2026, Avi): put on every newly entered
 * patient by itself, like "SOAP baru"; its text, colour and on/off set per
 * list in Setelan. Screen only, never printed.
 */
export interface NewBadge {
  label: string;
  color: MarkColor;
  on: boolean;
}

export function readNewBadge(raw: unknown): NewBadge | null {
  if (!raw || typeof raw !== 'object') return null;
  const { label, color, on } = raw as Record<string, unknown>;
  if (typeof label !== 'string' || !isMarkColor(color)) return null;
  return { label: label.trim().slice(0, 30) || DEFAULT_NEW_BADGE.label, color, on: on !== false };
}

export const DEFAULT_NEW_BADGE: NewBadge = { label: 'Pasien baru', color: 'teal', on: true };

/**
 * The badge in use: the one set in Setelan; else, for a list that had a
 * "Pasien baru" mark, that mark's text and colour (so nothing looks different
 * the day the mark retires); else the default.
 */
export function newBadgeOf(floor: { newBadge?: NewBadge | null | undefined; marks?: readonly FloorMark[] | undefined }): NewBadge {
  if (floor.newBadge) return floor.newBadge;
  const old = (floor.marks ?? []).find((m) => m.auto?.kind === 'baru');
  return old ? { label: old.label, color: old.color, on: true } : DEFAULT_NEW_BADGE;
}

/** 13.7 stored a hand mark as `colour` = "m:<id>"; read as a tag since 13.10. */
export const MARK_PREFIX = 'm:';

export const isMarkColor = (value: unknown): value is MarkColor =>
  typeof value === 'string' && (Object.hasOwn(MARK_COLORS, value) || hueOf(value as MarkColor) !== null);

/** The tags that go on paper (Word, PDF). */
export const printedTags = (tags: readonly PatientTag[] | undefined): PatientTag[] => (tags ?? []).filter((t) => t.print !== false);

/** The CSS colour of a mark (follows light/dark mode). */
export const markCss = (color: MarkColor): string => {
  const hue = hueOf(color);
  return hue === null ? `var(--mark-${color})` : `oklch(var(--hue-l) var(--hue-c) ${hue})`;
};

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
    const print = (entry as Record<string, unknown>).print === false ? { print: false as const } : {};
    const noFollowUp = (entry as Record<string, unknown>).noFollowUp === true ? { noFollowUp: true as const } : {};
    out.push({ id, label: label.trim(), color, ...(auto ? { auto } : {}), ...print, ...noFollowUp });
  }
  return out;
}

/** A new id that is not taken (short: it is stored on every marked patient). */
export function newMarkId(marks: readonly FloorMark[]): string {
  let n = marks.length + 1;
  while (marks.some((m) => m.id === `k${n}`)) n += 1;
  return `k${n}`;
}
