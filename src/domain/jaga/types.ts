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
 * person holding it in the confirmation message, and the two are different
 * strings on purpose — you REPORT "Bangsal B" and you ASK somebody whether
 * they are on "*Jaga Bangsal PJT B*".
 *
 * The `place` values are copied verbatim from the message file Avicenna sends,
 * including its inconsistencies: `Chief Konsul` and `Chief Jaga Non-PJT` carry
 * no `Jaga` prefix while every other post does, and `Non-PJT` is hyphenated
 * where the roster column is not. They are not tidied. This string is read by
 * a senior who is checking whether it matches their own roster line, and a
 * version that is neater than the one everybody else sends is a version that
 * reads as a different post.
 */
export const JAGA_POSTS = [
  { id: 'chiefPjt', label: 'Chief PJT', place: 'Chief Jaga PJT' },
  { id: 'chiefKonsul', label: 'Chief Konsul', place: 'Chief Konsul' },
  { id: 'chiefNonPjt', label: 'Chief Non PJT', place: 'Chief Jaga Non-PJT' },
  { id: 'igdA', label: 'IGD A', place: 'Jaga IGD A' },
  { id: 'igdB', label: 'IGD B', place: 'Jaga IGD B' },
  { id: 'cvcu', label: 'CVCU', place: 'Jaga CVCU PJT' },
  { id: 'pedi', label: 'Pediatri', place: 'Jaga Pediatri' },
  { id: 'rsws', label: 'RSWS/UH', place: 'Jaga RSWS/UH' },
  { id: 'bangsalA', label: 'Bangsal A', place: 'Jaga Bangsal PJT A' },
  { id: 'bangsalB', label: 'Bangsal B', place: 'Jaga Bangsal PJT B' },
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


/**
 * One paediatrics shift.
 *
 * `btkv` is a PPDS BTKV who is on alongside the cardiology resident. Printed
 * in the Formasi as `Raden (BTKV)/ Ken`, but never confirmed — the message
 * asks about the cardiology post, and that is who answers for it.
 */
export interface PediatriShift {
  date: ClinicalDate;
  shift: 'penuh' | 'pagi' | 'malam';
  /** The cardiology resident, by nickname as the sheet writes it. */
  name: string;
  btkv?: string;
}

export interface PediatriRoster {
  title: string;
  shifts: PediatriShift[];
  importedAt: string;
}
