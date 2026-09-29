import type { ScratchNote, ScratchNoteCategory } from '@/domain/types';

/**
 * Catatan: personal notes, stored as a MAP keyed by note id.
 *
 * WHY A MAP (the root cause this module removes)
 *
 * Catatan used to be one array on the profile (`notes`). Every keystroke in any
 * note rewrote the whole array, so two writes close together — a body save and
 * a rename, a body save and a reorder — raced, and whichever landed second
 * carried a stale copy of the other. `pendingBodies` patched the body path, but
 * the rename, add and delete paths never went through it and could still revert
 * text typed a second earlier (recurring pattern 5).
 *
 * `notesById.<id>.<field>` is written one leaf at a time, exactly like
 * `boardNotes`. Two writes to two different fields cannot overwrite each other,
 * so there is nothing to replay and nothing to settle.
 *
 * MIGRATION — on read, zero writes
 *
 * The old array (and the older single `scratchNote` before it) is read as a
 * fallback for any id the map does not have. A legacy note is copied into the
 * map the FIRST time it is changed, whole, so nothing about it is lost; the
 * array itself is never written again. Nothing is rewritten while you might be
 * mid-sentence in it.
 */

export interface NoteRecord {
  title: string;
  /** Rich text (HTML from the editor). The one HTML body in the app. */
  body: string;
  category?: ScratchNoteCategory;
  archived?: boolean;
  /** Pinned notes sit above the rest of their shelf. */
  pinned?: boolean;
  /**
   * Manual position within its group. Lower comes first. A number rather than
   * an index so a move writes ONE field (the midpoint of its new neighbours)
   * instead of renumbering the list.
   */
  order: number;
  createdAt: number;
  /** Last change to the title or body. Shown on the row; never used to sort. */
  updatedAt: number;
  /** Soft delete: the note goes to Sampah and can be restored. */
  deletedAt?: number;
}

export type NotesById = Record<string, NoteRecord>;

export interface ResolvedNote extends NoteRecord {
  id: string;
  category: ScratchNoteCategory;
  /** Still only in the legacy array; the first write copies it into the map. */
  legacy: boolean;
}

export type NoteView = 'aktif' | 'arsip' | 'sampah';

interface NoteSources {
  notesById?: unknown;
  notes?: ScratchNote[];
  scratchNote?: string;
}

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/**
 * Every note, from the map first and the legacy array for anything else.
 *
 * Defensive about shape: the map arrives from Firestore, where a half-applied
 * write or an older client can leave an entry missing a field. A note with a
 * missing title is still a note.
 */
export function resolveNotes(profile: NoteSources | null | undefined): ResolvedNote[] {
  const out: ResolvedNote[] = [];
  const seen = new Set<string>();

  const map = profile?.notesById;
  if (map && typeof map === 'object') {
    for (const [id, raw] of Object.entries(map as Record<string, unknown>)) {
      if (!raw || typeof raw !== 'object') continue;
      const entry = raw as Partial<NoteRecord> & { purgedAt?: unknown };
      seen.add(id);
      // Purged: the id stays claimed so a legacy copy cannot resurface.
      if (entry.purgedAt !== undefined) continue;
      out.push({
        id,
        title: typeof entry.title === 'string' ? entry.title : '',
        body: typeof entry.body === 'string' ? entry.body : '',
        category: entry.category === 'jaga' ? 'jaga' : 'umum',
        archived: entry.archived === true,
        pinned: entry.pinned === true,
        order: num(entry.order, 0),
        createdAt: num(entry.createdAt, 0),
        updatedAt: num(entry.updatedAt, 0),
        ...(typeof entry.deletedAt === 'number' ? { deletedAt: entry.deletedAt } : {}),
        legacy: false,
      });
    }
  }

  const legacy = profile?.notes ?? [];
  legacy.forEach((note, index) => {
    if (!note || typeof note.id !== 'string' || seen.has(note.id)) return;
    seen.add(note.id);
    out.push({
      id: note.id,
      title: note.title ?? '',
      body: note.body ?? '',
      category: note.category === 'jaga' ? 'jaga' : 'umum',
      archived: note.archived === true,
      pinned: false,
      // The array order was the user's order; keep it.
      order: index,
      createdAt: 0,
      updatedAt: 0,
      legacy: true,
    });
  });

  // The single note from before tabs existed, only if nothing else does.
  if (out.length === 0 && legacy.length === 0 && (profile?.scratchNote ?? '').trim()) {
    out.push({
      id: 'n1',
      title: 'Catatan',
      body: profile?.scratchNote ?? '',
      category: 'umum',
      archived: false,
      pinned: false,
      order: 0,
      createdAt: 0,
      updatedAt: 0,
      legacy: true,
    });
  }

  return out.sort(compareNotes);
}

/** Pinned first, then manual order. Ties by newest, then id, so it is stable. */
export function compareNotes(a: ResolvedNote, b: ResolvedNote): number {
  if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
  if (a.order !== b.order) return a.order - b.order;
  if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The notes one shelf shows.
 *
 * Sampah spans both shelves: it is where you go to find something you deleted,
 * and making you remember which shelf it was on first would defeat that.
 */
export function notesForView(
  notes: readonly ResolvedNote[],
  category: ScratchNoteCategory,
  view: NoteView,
): ResolvedNote[] {
  if (view === 'sampah') {
    return notes
      .filter((note) => note.deletedAt !== undefined)
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
  }
  const shown = notes.filter(
    (note) =>
      note.deletedAt === undefined &&
      note.category === category &&
      (view === 'arsip' ? note.archived === true : note.archived !== true),
  );
  if (!isDateOrdered(category, view)) return shown;
  // Newest made first; notes from before `createdAt` existed (0) go last, in
  // their old order.
  return [...shown].sort((a, b) => b.createdAt - a.createdAt || compareNotes(a, b));
}

/**
 * Archived jaga notes are a LOG: one per shift, read back by when they were
 * written. They are always in the order they were made, and cannot be
 * rearranged by hand (a hand-sorted log is one where the dates lie).
 */
export function isDateOrdered(category: ScratchNoteCategory, view: NoteView): boolean {
  return category === 'jaga' && view === 'arsip';
}

export function countView(
  notes: readonly ResolvedNote[],
  category: ScratchNoteCategory,
  view: NoteView,
): number {
  return notesForView(notes, category, view).length;
}

/**
 * Search across BOTH shelves and the archive, never the trash.
 *
 * Every word must appear somewhere in the title or the text, in any order, so
 * "ekg pak" finds a note that says "Pak B … EKG ulang". Active notes come
 * before archived ones; within each, the usual order.
 */
export function searchNotes(notes: readonly ResolvedNote[], query: string): ResolvedNote[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return notes
    .filter((note) => note.deletedAt === undefined)
    .filter((note) => {
      const hay = `${note.title}\n${notePlainText(note.body)}`.toLowerCase();
      return words.every((word) => hay.includes(word));
    })
    .sort((a, b) => {
      if (Boolean(a.archived) !== Boolean(b.archived)) return a.archived ? 1 : -1;
      return compareNotes(a, b);
    });
}

/**
 * The note's text without its markup, for rows, titles and search.
 *
 * Block tags become line breaks so the shape of the note survives. Checklist
 * rows show their state, in both the current markup (`li[data-checked]`) and
 * the older one (an `<input type=checkbox>` inside the row).
 */
export function notePlainText(body: string): string {
  return body
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>\s*<input[^>]*type="?checkbox"?[^>]*>/gi, (match) =>
      /\schecked/i.test(match) ? '☑ ' : '☐ ',
    )
    .replace(/<li[^>]*data-checked="true"[^>]*>/gi, '☑ ')
    .replace(/<li[^>]*data-checked="false"[^>]*>/gi, '☐ ')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * What a row calls the note.
 *
 * The typed title if there is one, otherwise the first line of the text —
 * so a new note never has to be named before it can be found. "Catatan 7"
 * was a name that told you nothing and had to be changed by hand.
 */
export function displayTitle(note: Pick<NoteRecord, 'title' | 'body'>): string {
  const typed = note.title.trim();
  if (typed) return typed;
  const first = notePlainText(note.body)
    .split('\n')
    .map((line) => line.replace(/^[•☐☑]\s*/, '').trim())
    .find(Boolean);
  if (!first) return 'Tanpa judul';
  return first.length > 60 ? `${first.slice(0, 59)}…` : first;
}

/**
 * The preview under the title: the text, minus the line already used as the
 * title when the title was derived from it.
 */
export function previewText(note: Pick<NoteRecord, 'title' | 'body'>): string {
  const text = notePlainText(note.body);
  if (note.title.trim()) return text;
  const lines = text.split('\n');
  const index = lines.findIndex((line) => line.replace(/^[•☐☑]\s*/, '').trim());
  return index === -1 ? '' : lines.slice(index + 1).join('\n').trim();
}

/** Ticked / total checklist rows, or null when the note has none. */
export function checklistProgress(body: string): { done: number; total: number } | null {
  let done = 0;
  let total = 0;
  for (const match of body.matchAll(/<li[^>]*data-checked="(true|false)"[^>]*>/gi)) {
    total += 1;
    if (match[1] === 'true') done += 1;
  }
  for (const match of body.matchAll(/<input[^>]*type="?checkbox"?[^>]*>/gi)) {
    total += 1;
    if (/\schecked/i.test(match[0])) done += 1;
  }
  return total === 0 ? null : { done, total };
}

/** An order that puts a new note above everything else. */
export function orderAtTop(notes: readonly ResolvedNote[]): number {
  if (notes.length === 0) return 0;
  return Math.min(...notes.map((note) => note.order)) - 1;
}

/**
 * The order that places `fromId` immediately before or after `targetId`,
 * within `list` (the group being shown — the moved note's neighbours are the
 * ones on screen, not ones a filter hides).
 *
 * Returns null when nothing would change. Only the moved note is written: its
 * new order is the midpoint of the two notes it lands between.
 */
export function orderForMove(
  list: readonly ResolvedNote[],
  fromId: string,
  targetId: string,
  place: 'before' | 'after',
): number | null {
  if (fromId === targetId) return null;
  const rest = list.filter((note) => note.id !== fromId);
  const targetIndex = rest.findIndex((note) => note.id === targetId);
  if (targetIndex === -1) return null;
  const insertAt = place === 'before' ? targetIndex : targetIndex + 1;
  const prev = rest[insertAt - 1];
  const next = rest[insertAt];

  const originalIndex = list.findIndex((note) => note.id === fromId);
  if (originalIndex === insertAt) return null;

  if (prev && next) {
    // Equal neighbours (possible after legacy notes all started at their index
    // on two devices) would give a midpoint equal to both; nudge instead.
    return prev.order === next.order ? prev.order + 1e-6 : (prev.order + next.order) / 2;
  }
  if (prev) return prev.order + 1;
  if (next) return next.order - 1;
  return null;
}

/**
 * A stable colour per note, derived from its id. Not stored: its only job is
 * telling one row from another at a glance, and derived means it never
 * changes for a given note. Shared card tokens, so it passes `check:contrast`.
 */
const PALETTE = [3, 5, 6, 7, 9, 12, 2, 4] as const;

export function noteTone(id: string): { bg: string; fg: string; accent: string } {
  let sum = 0;
  for (const char of id) sum = (sum + char.charCodeAt(0)) % 997;
  const step = PALETTE[sum % PALETTE.length] ?? 6;
  return {
    bg: `var(--card-step-${step}-bg)`,
    fg: `var(--card-step-${step}-fg)`,
    // The saturated one, for a thin edge: the pastel bg vanishes at 6 px.
    accent: `var(--card-step-${step}-accent)`,
  };
}

/** "baru saja", "12 mnt", "3 jam", "kemarin", or a short date. */
export function relativeTime(then: number, now: number): string {
  if (!then) return '';
  const minutes = Math.floor((now - then) / 60000);
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes} mnt`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'kemarin';
  if (days < 7) return `${days} hari`;
  const date = new Date(then);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}
