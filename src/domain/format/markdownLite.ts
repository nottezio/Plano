/**
 * SPEC 12.2 — the canonical inline format.
 *
 * Stored bodies use markdown-lite and ONLY markdown-lite:
 *
 *   bold **teks** · italic _teks_ · strike ~~teks~~ · bullet "- " · numbered "1. "
 *
 * Rationale, because it looks arbitrary until it bites: WhatsApp uses `*bold*`
 * while Markdown uses `*italic*`. Storing WhatsApp syntax makes every future
 * export a regex minefield and corrupts on round-trip — the same asterisk
 * means two different things depending on which way you are converting. One
 * canonical model in, N pure formatters out.
 *
 * Everything here is a pure text transform returning the new caret selection,
 * so the toolbar never has to reason about the DOM.
 */

/**
 * Single asterisk, as WhatsApp writes it and as the notes are actually typed.
 *
 * This used to be `**`, the Markdown spelling, on the reasoning that the stored
 * body should be canonical Markdown. But the body is read and written by people
 * who write `*bold*`, and pressing B produced two asterisks they then deleted.
 * The parser and every formatter have accepted both spellings since the
 * WhatsApp-paste work, so storing the one that gets typed costs nothing.
 */
export const BOLD = '*';
export const ITALIC = '_';
export const STRIKE = '~~';

export interface TextEdit {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Toggles a wrapping marker around the selection.
 *
 * With an empty selection it inserts the pair and places the caret between
 * them, which is what a Bold press means when you are about to type.
 */
export function toggleWrap(
  text: string,
  start: number,
  end: number,
  marker: string,
): TextEdit {
  const selected = text.slice(start, end);
  const before = text.slice(0, start);
  const after = text.slice(end);
  const width = marker.length;

  // Already wrapped, markers inside the selection.
  if (
    selected.length >= width * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const stripped = selected.slice(width, selected.length - width);
    return {
      text: `${before}${stripped}${after}`,
      selectionStart: start,
      selectionEnd: start + stripped.length,
    };
  }

  // Already wrapped, markers just outside the selection.
  if (before.endsWith(marker) && after.startsWith(marker)) {
    const trimmedBefore = before.slice(0, before.length - width);
    const trimmedAfter = after.slice(width);
    return {
      text: `${trimmedBefore}${selected}${trimmedAfter}`,
      selectionStart: start - width,
      selectionEnd: start - width + selected.length,
    };
  }

  return {
    text: `${before}${marker}${selected}${marker}${after}`,
    selectionStart: start + width,
    selectionEnd: start + width + selected.length,
  };
}

/** Line range [lineStart, lineEnd) covering the selection. */
function lineBounds(text: string, start: number, end: number): [number, number] {
  const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const newline = text.indexOf('\n', end);
  return [lineStart, newline === -1 ? text.length : newline];
}

const BULLET = '- ';
const NUMBERED = /^(\s*)(\d+)\. /;

/**
 * Toggles "- " on every selected line. Removing wins if every line already has
 * it, so a second press is always an undo rather than a stutter.
 */
export function toggleBullet(text: string, start: number, end: number): TextEdit {
  const [lineStart, lineEnd] = lineBounds(text, start, end);
  const block = text.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const allBulleted = lines.every((line) => line.trimStart().startsWith(BULLET));

  const next = lines
    .map((line) => {
      const indent = line.slice(0, line.length - line.trimStart().length);
      const content = line.trimStart();
      if (allBulleted) return indent + content.slice(BULLET.length);
      if (content.length === 0) return line;
      return `${indent}${BULLET}${content.replace(NUMBERED, '')}`;
    })
    .join('\n');

  return replaceBlock(text, lineStart, lineEnd, next, start, end);
}

/** Toggles "1. " numbering, renumbering the whole selected block. */
export function toggleNumbered(text: string, start: number, end: number): TextEdit {
  const [lineStart, lineEnd] = lineBounds(text, start, end);
  const lines = text.slice(lineStart, lineEnd).split('\n');
  const allNumbered = lines.every((line) => NUMBERED.test(line));

  let counter = 0;
  const next = lines
    .map((line) => {
      const indent = line.slice(0, line.length - line.trimStart().length);
      const content = line.trimStart();
      if (allNumbered) return indent + content.replace(NUMBERED, '');
      if (content.length === 0) return line;
      counter += 1;
      return `${indent}${counter}. ${content.replace(NUMBERED, '').replace(/^- /, '')}`;
    })
    .join('\n');

  return replaceBlock(text, lineStart, lineEnd, next, start, end);
}

function replaceBlock(
  text: string,
  lineStart: number,
  lineEnd: number,
  replacement: string,
  start: number,
  end: number,
): TextEdit {
  const delta = replacement.length - (lineEnd - lineStart);
  return {
    text: text.slice(0, lineStart) + replacement + text.slice(lineEnd),
    selectionStart: Math.max(lineStart, start),
    selectionEnd: Math.max(lineStart, end + delta),
  };
}

/**
 * SPEC F4 — "Sisipkan bagian".
 *
 * Inserts a recognised header line at the caret. This is how the user opts
 * INTO parseable structure; nothing forces it, and the parser only ever
 * detects what is already there.
 */
export function insertSectionHeader(text: string, caret: number, label: string): TextEdit {
  const header = `${label}: `;
  const atLineStart = caret === 0 || text.charAt(caret - 1) === '\n';
  const prefix = atLineStart ? '' : '\n';
  const needsTrailingBreak = caret < text.length && text.charAt(caret) !== '\n';
  const suffix = needsTrailingBreak ? '\n' : '';

  const inserted = `${prefix}${header}${suffix}`;
  const caretAfter = caret + prefix.length + header.length;

  return {
    text: text.slice(0, caret) + inserted + text.slice(caret),
    selectionStart: caretAfter,
    selectionEnd: caretAfter,
  };
}

/**
 * Restore the emphasis a plain-text paste lost.
 *
 * Copying a SOAP out of WhatsApp and back in strips the markers, so headings
 * arrive as bare text. This puts them back by recognising the lines that are
 * always emphasised in a report — the headings themselves — and nothing else.
 *
 * Deliberately NOT automatic. Applying it on paste would edit text the moment
 * it arrives, and the one time it guessed wrong there would be no way to tell
 * what the original said. It is an action on the toolbar; you look at the
 * result and keep it or undo it.
 *
 * It never touches a line that already carries a marker, so running it twice
 * changes nothing.
 */
const HEADING_PATTERNS: readonly RegExp[] = [
  /^(S|O|A|P)\s*[:/]\s*$/i,
  /^Mohon i[zj]in .*(assess|assessment|terapi|inisial terapi) dengan\s*:?\s*$/i,
  /^Plan\s*:?\s*$/i,
  /^Diagnosis( Primer| Sekunder)?\s*:?\s*$/i,
  /^Problem\s*:?\s*$/i,
  /^TS [A-Z].*$/,
  /^(EKG|Laboratorium|Lab|Foto Thorax|Echo\w*|LUS|Laporan|USG|CT|MRI|Holter|AGD|Urinalisa)\b.*\(?\d{2}[-/]\d{2}[-/]\d{2,4}\)?\s*$/i,
];

/** Italic in a report: the DPJP lines and the referral sentence. */
const ITALIC_PATTERNS: readonly RegExp[] = [
  /^_?DPJP\b.*$/i,
  /^Pasien (dikonsul|dirujuk|rencana|datang|masuk)\b.*$/i,
  /^Rencana tindakan\s*:.*$/i,
];

export function restoreEmphasis(body: string): string {
  return body
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.includes('*') || trimmed.startsWith('_')) return line;

      if (HEADING_PATTERNS.some((pattern) => pattern.test(trimmed))) return `*${trimmed}*`;
      if (ITALIC_PATTERNS.some((pattern) => pattern.test(trimmed))) return `_${trimmed}_`;
      return line;
    })
    .join('\n');
}

/**
 * The bullet an iPhone keyboard inserts, turned back into a hyphen.
 *
 * Separate from `restoreEmphasis` because it is a different decision: this one
 * is safe to run on anything, since `•` at the start of a line is never
 * anything but a bullet.
 */
export function normaliseBullets(body: string): string {
  return body.replace(/^([ \t]*)[•‣▪·]\s*/gm, '$1- ');
}
