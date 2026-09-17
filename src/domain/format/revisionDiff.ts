import { diff_match_patch, DIFF_DELETE, DIFF_EQUAL, DIFF_INSERT } from 'diff-match-patch';

import { stripInvisible, toPlain } from './formatters';

/**
 * "What did the chief change?" — my note against a revised copy pasted back.
 *
 * Revisions arrive without a description of what changed, and usually by a
 * different route from the one the note left by. A note sent over WhatsApp
 * comes back with its markers; one that went through SIMGOS comes back with
 * none, with different blank lines and sometimes different spaces. Compared
 * raw, every heading would show as changed and the one edited dose would be
 * lost among them. So the default comparison is of CONTENT: both sides go
 * through the same normalisation before a line is compared.
 *
 * A line that was edited rather than replaced (a dose, a day counter, one
 * word) is shown as ONE row with the words that changed marked inside it.
 * A whole-line delete followed by a whole-line insert makes the reader find
 * the difference between two long lines by eye, which is the job this is
 * supposed to do.
 */

export interface WordPart {
  type: 'equal' | 'insert' | 'delete';
  text: string;
}

export type RevisionRow =
  | { kind: 'same'; text: string }
  | { kind: 'added'; text: string }
  | { kind: 'removed'; text: string }
  | { kind: 'changed'; parts: WordPart[] };

export interface RevisionDiff {
  rows: RevisionRow[];
  changed: number;
  added: number;
  removed: number;
  identical: boolean;
}

export interface RevisionOptions {
  /**
   * Compare content only: WhatsApp/markdown markers, non-ASCII look-alikes,
   * trailing spaces and blank lines are not changes. On by default in the UI.
   */
  ignoreFormatting: boolean;
}

/**
 * Both sides, made comparable.
 *
 * Always: CRLF, invisible characters and trailing spaces. None of these can be
 * seen, so showing one as a change would send the reader looking for nothing.
 * With `ignoreFormatting`: the plain-text rendering, and blank lines dropped,
 * because paragraph spacing is what a round trip through another system
 * changes most.
 */
export function normaliseForRevision(text: string, options: RevisionOptions): string {
  const base = stripInvisible(text.replace(/\r\n?/g, '\n'));
  const shaped = options.ignoreFormatting ? toPlain(base) : base;
  const lines = shaped.split('\n').map((line) => line.replace(/[ \t]+$/, ''));
  const kept = options.ignoreFormatting
    ? lines.filter((line) => line.trim().length > 0).map((line) => line.replace(/[ \t]{2,}/g, ' '))
    : lines;
  return kept.join('\n').trim();
}

/** Lines of a diff chunk, without the empty string after its final newline. */
function linesOf(text: string): string[] {
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

function lineDiff(before: string, after: string): Array<[number, string[]]> {
  const dmp = new diff_match_patch();
  // Trailing newline on both, so the last line is compared as a whole line
  // rather than as a fragment that happens to lack its terminator.
  const encoded = dmp.diff_linesToChars_(`${before}\n`, `${after}\n`);
  const diffs = dmp.diff_main(encoded.chars1, encoded.chars2, false);
  dmp.diff_charsToLines_(diffs, encoded.lineArray);
  return diffs.map(([op, text]) => [op, linesOf(text)]);
}

/**
 * Word-level diff of one line against another.
 *
 * Words and the whitespace between them are the units, so `5 mg` → `10 mg`
 * marks the number and leaves `mg` alone, instead of marking stray letters
 * the way a character diff does.
 */
export function diffWords(before: string, after: string): WordPart[] {
  const tokens: string[] = [];
  const index = new Map<string, number>();
  const encode = (text: string): string =>
    (text.match(/\s+|[^\s]+/g) ?? [])
      .map((token) => {
        let code = index.get(token);
        if (code === undefined) {
          code = tokens.length;
          tokens.push(token);
          index.set(token, code);
        }
        return String.fromCharCode(code + 1);
      })
      .join('');

  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(encode(before), encode(after), false);
  const decoded = diffs.map(([op, chars]) => ({
    type: op === DIFF_INSERT ? ('insert' as const) : op === DIFF_DELETE ? ('delete' as const) : ('equal' as const),
    text: [...chars].map((char) => tokens[char.charCodeAt(0) - 1] ?? '').join(''),
  }));

  // Adjacent parts of the same type read as one edit.
  return decoded.reduce<WordPart[]>((out, part) => {
    const last = out.at(-1);
    if (last && last.type === part.type) last.text += part.text;
    else out.push({ ...part });
    return out;
  }, []);
}

/**
 * Is this an EDIT of that line, or a different line in its place?
 *
 * By the share of words kept. Below half, pairing them would mark nearly
 * everything and read worse than a plain removed/added pair.
 */
function isEdit(parts: readonly WordPart[]): boolean {
  const words = (type: WordPart['type']): number =>
    parts
      .filter((part) => part.type === type)
      .reduce((sum, part) => sum + (part.text.match(/[^\s]+/g)?.length ?? 0), 0);
  const kept = words('equal');
  const longest = Math.max(kept + words('delete'), kept + words('insert'));
  return longest > 0 && kept / longest >= 0.5;
}

export function diffRevision(
  mine: string,
  revised: string,
  options: RevisionOptions,
): RevisionDiff {
  const before = normaliseForRevision(mine, options);
  const after = normaliseForRevision(revised, options);
  const chunks = lineDiff(before, after);

  const rows: RevisionRow[] = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const [op, lines] = chunks[i] as [number, string[]];

    if (op === DIFF_EQUAL) {
      for (const text of lines) rows.push({ kind: 'same', text });
      continue;
    }

    if (op === DIFF_INSERT) {
      for (const text of lines) rows.push({ kind: 'added', text });
      continue;
    }

    // A delete. If an insert follows, pair them line by line where the pair
    // is an edit; whatever does not pair stays a removal or an addition.
    const next = chunks[i + 1];
    const inserted = next && next[0] === DIFF_INSERT ? next[1] : [];
    if (inserted.length > 0) i += 1;

    // In position order, so an edit never appears above a line that came
    // before it in the note.
    const paired = Math.max(lines.length, inserted.length);
    for (let k = 0; k < paired; k += 1) {
      const gone = lines[k];
      const come = inserted[k];
      if (gone !== undefined && come !== undefined) {
        const parts = diffWords(gone, come);
        if (isEdit(parts)) {
          rows.push({ kind: 'changed', parts });
          continue;
        }
      }
      if (gone !== undefined) rows.push({ kind: 'removed', text: gone });
      if (come !== undefined) rows.push({ kind: 'added', text: come });
    }
  }

  const count = (kind: RevisionRow['kind']): number =>
    rows.filter((row) => row.kind === kind).length;
  const changed = count('changed');
  const added = count('added');
  const removed = count('removed');

  return { rows, changed, added, removed, identical: changed + added + removed === 0 };
}
