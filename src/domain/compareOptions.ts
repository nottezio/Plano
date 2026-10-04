import { daysBetween, formatShortDate } from './clinicalDate';
import type { ClinicalDate } from './types';

/**
 * What the Bandingkan picker offers, shaped for choosing.
 *
 * The picker used to be two rows of up to thirteen chips each — every day,
 * every version and every jaga note in one flat run, repeated once per pane.
 * Days and versions looked alike, the same list appeared twice, which pair
 * was selected was a matter of finding two highlighted chips in a wall of
 * them, and anything older than the twelfth entry could not be reached.
 *
 * Grouped by DATE instead, with each date's notes under it (the day's SOAP
 * first, then its versions and jaga notes): the question a resident asks is
 * "which day", then "which note on that day".
 */

export interface CompareEntry {
  key: string;
  date: ClinicalDate;
  kind: 'harian' | 'jaga' | 'versi';
  /** `HH.MM` for a jaga note or version. */
  time?: string;
  /** The note's name for a version or jaga note. */
  label?: string;
}

/** The note open in the editor, which is the `null` key. */
export interface OpenNote {
  date: ClinicalDate;
  kind: 'harian' | 'jaga' | 'versi';
  /** `SOAP`, `Versi dr. AHA`, `Jaga 21.40`. */
  name: string;
}

export interface CompareOption {
  /** `null` is the open note. */
  key: string | null;
  kind: 'harian' | 'jaga' | 'versi';
  /** The name within its date: `SOAP`, `Versi dr. AHA`, `Jaga 21.40`. */
  name: string;
  open: boolean;
}

export interface CompareGroup {
  date: ClinicalDate;
  /** `Sab, 3 Okt`. */
  dateLabel: string;
  /** Relative to the open note's day: `hari yang sama`, `H-1`, `H+2`. */
  relative: string;
  options: CompareOption[];
}

export function entryName(entry: Pick<CompareEntry, 'kind' | 'label' | 'time'>): string {
  if (entry.kind === 'harian') return 'SOAP';
  return entry.label ?? (entry.kind === 'versi' ? 'Versi' : `Jaga ${entry.time ?? ''}`.trim());
}

/** `Sab, 3 Okt · SOAP` — a note named fully, for a pane header. */
export function fullLabel(date: ClinicalDate, name: string): string {
  return `${formatShortDate(date)} · ${name}`;
}

export function relativeDay(date: ClinicalDate, to: ClinicalDate): string {
  // The IGD entry has no calendar date; say nothing rather than "same day".
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return '';
  const offset = daysBetween(to, date);
  if (offset === 0) return 'hari yang sama';
  return offset < 0 ? `H${offset}` : `H+${offset}`;
}

const KIND_ORDER = { harian: 0, versi: 1, jaga: 2 } as const;

/**
 * Every comparable note, newest date first, the open note included in its
 * own date (it may be the only note there).
 */
export function groupCompareOptions(
  entries: readonly CompareEntry[],
  open: OpenNote,
  openKey: string,
): CompareGroup[] {
  const byDate = new Map<ClinicalDate, Array<CompareOption & { order: number; time: string }>>();
  const push = (date: ClinicalDate, option: CompareOption, time: string): void => {
    const list = byDate.get(date) ?? [];
    list.push({ ...option, order: KIND_ORDER[option.kind], time });
    byDate.set(date, list);
  };

  push(open.date, { key: null, kind: open.kind, name: open.name, open: true }, '');
  for (const entry of entries) {
    if (entry.key === openKey) continue;
    push(entry.date, { key: entry.key, kind: entry.kind, name: entryName(entry), open: false }, entry.time ?? '');
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, options]) => ({
      date,
      dateLabel: formatShortDate(date),
      relative: relativeDay(date, open.date),
      options: options
        .sort((a, b) => a.order - b.order || a.time.localeCompare(b.time))
        .map(({ order: _order, time: _time, ...option }) => option),
    }));
}

export interface CompareSuggestion {
  key: string;
  /** What the shortcut says: `SOAP asli`, `Hari sebelumnya`. */
  label: string;
  detail: string;
}

/**
 * One-tap partners for the open note, most useful first.
 *
 *  - SOAP asli: the open note is a version or jaga note; its day's own SOAP is
 *    what it was made from or follows.
 *  - Hari sebelumnya: the newest day's SOAP BEFORE the open note's day, which
 *    is the "what changed since yesterday" question — not strictly yesterday,
 *    which may have no note.
 *  - Each other version of the same day, by name.
 */
export function compareSuggestions(
  entries: readonly CompareEntry[],
  open: OpenNote,
  openKey: string,
): CompareSuggestion[] {
  const out: CompareSuggestion[] = [];
  const others = entries.filter((entry) => entry.key !== openKey);

  if (open.kind !== 'harian') {
    const own = others.find((entry) => entry.date === open.date && entry.kind === 'harian');
    if (own) out.push({ key: own.key, label: 'SOAP asli', detail: formatShortDate(own.date) });
  }

  const before = others
    .filter((entry) => entry.kind === 'harian' && entry.date < open.date)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (before) {
    out.push({
      key: before.key,
      label: 'Hari sebelumnya',
      detail: `${formatShortDate(before.date)} · ${relativeDay(before.date, open.date)}`,
    });
  }

  for (const entry of others) {
    if (entry.date !== open.date || entry.kind !== 'versi') continue;
    out.push({ key: entry.key, label: entryName(entry), detail: 'versi hari ini' });
  }

  return out;
}

/** The default left pane: the first suggestion, else the newest other note. */
export function defaultPartner(
  entries: readonly CompareEntry[],
  open: OpenNote,
  openKey: string,
): string | null {
  return (
    compareSuggestions(entries, open, openKey)[0]?.key ??
    entries.find((entry) => entry.key !== openKey)?.key ??
    null
  );
}
