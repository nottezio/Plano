import { lineAt, resolveBookmark, type LineBookmark } from './bookmarks';

/**
 * Marker ("stabilo") on lines of the day's SOAP: "I have not changed this yet".
 *
 * Same anchor as a line bookmark (the line's trimmed text + which occurrence),
 * for the same reason: the body is one free-form string, so nothing can be
 * written into it. Unlike a bookmark it is NOT re-anchored through an edit: once
 * the line is changed it stops resolving and the mark disappears, which is
 * exactly "done". Kept on the device, so it costs no Firestore reads or writes.
 */
export type LineMark = Pick<LineBookmark, 'text' | 'nth'>;

const MAX_MARKS = 200;

/** The non-empty lines touched by `[start, end]`. */
function linesIn(body: string, start: number, end: number): Array<LineMark & { start: number; end: number }> {
  const found: Array<LineMark & { start: number; end: number }> = [];
  let at = lineAt(body, start);
  for (;;) {
    if (at.text) found.push({ text: at.text, nth: at.nth, start: at.start, end: at.end });
    if (at.end >= end || at.end >= body.length) break;
    at = lineAt(body, at.end + 1);
  }
  return found;
}

const same = (a: LineMark, b: LineMark): boolean => a.text === b.text && a.nth === b.nth;

/** Marks after pressing the button over `[start, end]`: all marked already → unmark them, else mark them all. */
export function toggleMarks(body: string, marks: readonly LineMark[], start: number, end: number): LineMark[] {
  const lines = linesIn(body, start, end);
  if (lines.length === 0) return [...marks];
  const allMarked = lines.every((line) => marks.some((mark) => same(mark, line)));
  if (allMarked) return marks.filter((mark) => !lines.some((line) => same(mark, line)));
  const added = lines.filter((line) => !marks.some((mark) => same(mark, line))).map(({ text, nth }) => ({ text, nth }));
  return [...marks, ...added].slice(-MAX_MARKS);
}

/** Where the marked lines are in this body (marks whose line was edited are not). */
export function resolveMarks(body: string, marks: readonly LineMark[]): Array<{ start: number; end: number }> {
  const spans = new Map<number, { start: number; end: number }>();
  for (const mark of marks) {
    // shortcut: a deleted duplicate leaves the mark on the last copy (as bookmarks do).
    const span = resolveBookmark(body, { ...mark, createdAt: '' });
    if (span) spans.set(span.start, span);
  }
  return [...spans.values()].sort((a, b) => a.start - b.start);
}

/** True when the caret/selection sits on a marked line, for the button's pressed state. */
export function isMarked(body: string, marks: readonly LineMark[], offset: number): boolean {
  const line = lineAt(body, offset);
  return resolveMarks(body, marks).some((span) => span.start === line.start);
}
