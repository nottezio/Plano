import { parseSections } from '../sections/parseSections';
import type { SectionAlias } from '../types';

/**
 * Add a line to the end of OUR Terapi list (2026-10-10, heparin card).
 *
 * The first Terapi section in the note is ours: consult replies (TS …) come
 * after it, and a line added to one of them would read as the consultant's
 * order. Within it, a "Selesai :" sub-list holds drugs already stopped, so
 * the new line goes ABOVE that, at the end of the running list.
 *
 * Null when the note has no Terapi section: guessing a place for a drug
 * order is worse than saying there is none, and the card falls back to
 * "Salin baris".
 */
export function insertIntoTerapi(body: string, line: string, aliases?: readonly SectionAlias[]): string | null {
  const terapi = parseSections(body, aliases).find((section) => section.sectionId === 'terapi');
  if (!terapi) return null;
  const content = body.slice(terapi.textStart, terapi.end);
  const done = /^[ \t]*[*_]*selesai[*_]*[ \t]*:?[ \t]*[*_]*[ \t]*$/im.exec(content);
  const at = done ? terapi.textStart + done.index : terapi.end;
  const before = body.slice(0, at).replace(/\s*$/, '');
  const after = body.slice(at).replace(/^\s*/, '');
  return `${before}\n${line.trim()}${after ? `\n\n${after}` : '\n'}`;
}
