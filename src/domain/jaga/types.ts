import type { ClinicalDate } from '@/domain/types';

/**
 * The ten posts, in the order the Formasi Jaga message lists them.
 *
 * Fixed: the roster changes who is on each post, never which posts exist. So
 * this is a constant rather than something read out of the PDF — a parser that
 * discovers its own columns would silently produce a nine-post message the
 * month a header is renamed, and nobody would notice until a senior was left
 * off a report.
 *
 * `label` is what the Formasi prints. `place` is how the post is named TO the
 * person holding it in the confirmation message, which is not always the same
 * string — you report "Bangsal A" and you ask someone whether they are on
 * "Bangsal PJT A".
 */
export const JAGA_POSTS = [
  { id: 'chiefPjt', label: 'Chief PJT', place: 'Chief Jaga PJT' },
  { id: 'chiefKonsul', label: 'Chief Konsul', place: 'Chief Jaga Konsul' },
  { id: 'chiefNonPjt', label: 'Chief Non PJT', place: 'Chief Jaga Non PJT' },
  { id: 'igdA', label: 'IGD A', place: 'IGD A' },
  { id: 'igdB', label: 'IGD B', place: 'IGD B' },
  { id: 'cvcu', label: 'CVCU', place: 'CVCU' },
  { id: 'pedi', label: 'Pediatri', place: 'Pediatri' },
  { id: 'rsws', label: 'RSWS/UH', place: 'RSWS/UH' },
  { id: 'bangsalA', label: 'Bangsal A', place: 'Bangsal PJT A' },
  { id: 'bangsalB', label: 'Bangsal B', place: 'Bangsal PJT B' },
] as const;

export type JagaPostId = (typeof JAGA_POSTS)[number]['id'];

/**
 * One team, for one date and one shift.
 *
 * `shift` is `'penuh'` on a weekday — one team covers the whole day — and
 * `'pagi'` / `'malam'` at the weekend, where they are different people
 * entirely and each gets its own Formasi.
 *
 * Values are INITIALS, exactly as the roster prints them. Resolving an initial
 * to a person is a separate step with its own failure mode, and keeping the
 * raw value means an unresolvable initial still shows up in the message as
 * itself rather than vanishing.
 */
export interface JagaShift {
  date: ClinicalDate;
  shift: 'penuh' | 'pagi' | 'malam';
  /** As printed: `Selasa`, `Minggu Pagi`. Kept for display, not parsed from. */
  hari: string;
  posts: Partial<Record<JagaPostId, string>>;
}

/** Initial → full name, from the legend tables beside the roster. */
export type InitialsIndex = Record<string, string>;

export interface JagaRoster {
  /** Title line, so the user can see which month they imported. */
  title: string;
  shifts: JagaShift[];
  initials: InitialsIndex;
  importedAt: string;
}

/** One consultant pair for one date. */
export interface DpjpDay {
  date: ClinicalDate;
  utama: string;
  tindakan: string;
}

export interface DpjpRoster {
  title: string;
  days: DpjpDay[];
  importedAt: string;
}

/**
 * A resident, as the Jarkom sheet knows them.
 *
 * `agama` decides the greeting and is the only reason this document is needed
 * at all — nothing else in the process records it.
 */
export interface JarkomEntry {
  name: string;
  panggilan: string;
  muslim: boolean;
}

export interface JarkomDirectory {
  entries: JarkomEntry[];
  importedAt: string;
}
