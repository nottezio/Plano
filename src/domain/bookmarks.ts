import { mapOffset } from './caret';

/**
 * Line bookmarks in the day's SOAP.
 *
 * The body is ONE free-form string (SPEC: never fields), so a bookmark cannot
 * be a marker written into it — the parser is lossless and the note is copied
 * verbatim to SIMGOS and WhatsApp, where any marker would arrive as text.
 * It cannot be a line NUMBER either: every line typed above it would move it
 * onto somebody else's line.
 *
 * So a bookmark is the line's own TEXT (trimmed), plus which occurrence it is
 * when the same line appears more than once (`- Cek DL` in two sections).
 * Stored on the patient rather than the day, because the SOAP is carried
 * forward: the line bookmarked yesterday is, in the common case, the same line
 * in today's note, and it should still be there.
 *
 * Text anchors go stale when the line itself is edited — which is the common
 * case for a line worth bookmarking (`K 3,1` → `K 3,5`). `reanchorBookmarks`
 * follows the edit through the same offset mapping the editor uses for its
 * caret, so typing into a bookmarked line carries the bookmark with it.
 */
export interface LineBookmark {
  /** The line, trimmed. Never empty. */
  text: string;
  /** Which occurrence of `text`, 0-based, when the note repeats the line. */
  nth: number;
  createdAt: string;
}

export type BookmarkMap = Readonly<Record<string, LineBookmark>>;

export interface LineSpan {
  /** Offset of the line's first character. */
  start: number;
  /** Offset just past its last character (before the newline). */
  end: number;
  /** Trimmed text. */
  text: string;
  nth: number;
}

export interface ResolvedBookmark {
  id: string;
  start: number;
  end: number;
  label: string;
}

/** The line containing `offset`. */
export function lineAt(body: string, offset: number): LineSpan {
  const at = Math.max(0, Math.min(offset, body.length));
  const start = body.lastIndexOf('\n', at - 1) + 1;
  const newline = body.indexOf('\n', at);
  const end = newline < 0 ? body.length : newline;
  const text = body.slice(start, end).trim();
  return { start, end, text, nth: text ? occurrenceBefore(body, text, start) : 0 };
}

/** How many lines before `start` trim to `text`. */
function occurrenceBefore(body: string, text: string, start: number): number {
  let count = 0;
  let from = 0;
  while (from < start) {
    const newline = body.indexOf('\n', from);
    const end = newline < 0 ? body.length : newline;
    if (body.slice(from, end).trim() === text) count += 1;
    if (newline < 0) break;
    from = newline + 1;
  }
  return count;
}

/** Every line that trims to `text`, in order. */
function occurrences(body: string, text: string): Array<{ start: number; end: number }> {
  const found: Array<{ start: number; end: number }> = [];
  let from = 0;
  for (;;) {
    const newline = body.indexOf('\n', from);
    const end = newline < 0 ? body.length : newline;
    if (body.slice(from, end).trim() === text) found.push({ start: from, end });
    if (newline < 0) break;
    from = newline + 1;
  }
  return found;
}

/**
 * Where a bookmark's line is in this body, or null when it is not there.
 *
 * The `nth` occurrence when there are enough, else the LAST: a duplicate
 * deleted above it leaves the bookmark on the remaining copy rather than
 * losing it.
 */
export function resolveBookmark(
  body: string,
  bookmark: LineBookmark,
): { start: number; end: number } | null {
  if (!bookmark.text) return null;
  const all = occurrences(body, bookmark.text);
  if (all.length === 0) return null;
  return all[Math.min(bookmark.nth, all.length - 1)] ?? null;
}

/**
 * What the chip says: the line without its emphasis markers or bullet, cut
 * to fit. `*Mohon izin kami assess dengan*` → `Mohon izin kami assess…`.
 */
export function bookmarkLabel(text: string, max = 24): string {
  const plain = text
    .replace(/^\s*(?:[-*•]\s+|\d+[.)]\s+)/, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}

/**
 * The bookmarks present in this body, top to bottom, and the ids of those
 * that are not — kept, not dropped: a line absent from one day's note may be
 * back in the next.
 */
export function resolveBookmarks(
  body: string,
  bookmarks: BookmarkMap,
): { resolved: ResolvedBookmark[]; missing: string[] } {
  const resolved: ResolvedBookmark[] = [];
  const missing: string[] = [];
  for (const [id, bookmark] of Object.entries(bookmarks)) {
    const span = resolveBookmark(body, bookmark);
    if (span) resolved.push({ id, ...span, label: bookmarkLabel(bookmark.text) });
    else missing.push(id);
  }
  /*
    Two bookmarks can resolve to one line (the same text bookmarked twice from
    two devices). One chip per line: the second would jump to the same place.
  */
  resolved.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const unique = resolved.filter((entry, index) => resolved[index - 1]?.start !== entry.start);
  return { resolved: unique, missing };
}

/** The bookmark on the line holding `offset`, if any. */
export function bookmarkOnLine(body: string, bookmarks: BookmarkMap, offset: number): string | null {
  const line = lineAt(body, offset);
  if (!line.text) return null;
  for (const [id, bookmark] of Object.entries(bookmarks)) {
    const span = resolveBookmark(body, bookmark);
    if (span && span.start === line.start) return id;
  }
  return null;
}

/**
 * Follow bookmarked lines through an edit.
 *
 * Returns ONLY the bookmarks that changed, so the caller writes a leaf per
 * change and nothing else (pattern 5: never rewrite the whole map).
 *
 * A bookmark that resolved before and does not now had its line edited or
 * removed. Its start is mapped through the edit; the line found there takes
 * over only if it plausibly IS the old line edited — sharing a prefix or
 * suffix covering ~40% of the shorter text. A line deleted outright leaves the
 * bookmark unresolved rather than handing it to whichever neighbour moved up,
 * which would be a bookmark on a line nobody chose.
 */
export function reanchorBookmarks(
  before: string,
  after: string,
  bookmarks: BookmarkMap,
): Record<string, LineBookmark> {
  const changed: Record<string, LineBookmark> = {};
  if (before === after) return changed;
  for (const [id, bookmark] of Object.entries(bookmarks)) {
    const was = resolveBookmark(before, bookmark);
    if (!was) continue;
    // Exactly where it was (its own occurrence, not the last-copy fallback
    // `resolveBookmark` allows): nothing to follow.
    if (occurrences(after, bookmark.text)[bookmark.nth]) continue;
    const line = lineAt(after, mapOffset(before, after, was.start));
    if (!line.text || !sameLineEdited(bookmark.text, line.text)) continue;
    changed[id] = { ...bookmark, text: line.text, nth: line.nth };
  }
  return changed;
}

function sameLineEdited(old: string, next: string): boolean {
  const limit = Math.min(old.length, next.length);
  let prefix = 0;
  while (prefix < limit && old[prefix] === next[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < limit - prefix &&
    old[old.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const shared = prefix + suffix;
  return shared >= Math.min(6, limit) && shared >= limit * 0.4;
}
