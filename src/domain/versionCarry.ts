import { diffSegmentsByLine } from './merge/threeWayMerge';

/**
 * "Versi dr. AHA" for today: yesterday's version, plus what changed in the
 * SOAP since yesterday.
 *
 * The version is a shortened copy the resident edits by hand (folded vitals,
 * one-line physical exam, one-sentence S). Remaking it from today's full SOAP
 * every morning means redoing all of that; copying yesterday's and patching it
 * means remembering which lines of the full SOAP changed overnight, which is
 * the step people forget.
 *
 * So the change is read, not remembered: diff yesterday's SOAP against
 * today's, and replay each change onto yesterday's version where the version
 * still has the text being changed.
 *
 * WHAT LANDS, in order of how sure the placement is:
 *   1. The changed lines appear in the version exactly once, as whole lines
 *      (a therapy line, a plan line): replaced.
 *   2. Same number of lines before and after, each old line found exactly once
 *      as a line or INSIDE a version line (vitals folded onto one line with
 *      ` ; `): the old text is swapped for the new within that line.
 *   3. Lines only added: placed next to the nearest unchanged neighbour the
 *      version still has (a new drug after the last one, a new EKG block above
 *      the old EKG heading even when the version folded that heading's body
 *      onto it).
 *
 * WHAT DOES NOT: everything else is returned as `pending`, with the old and
 * the new text, for the resident to apply by hand. That is the point of the
 * feature — a change that could not be placed is shown, never dropped. A wrong
 * placement is worse than a listed one (the same stance as the sync merge), so
 * any ambiguity (a line found twice) is pending too.
 *
 * Known gap, stated in the sheet: a change to yesterday's SOAP made AFTER
 * yesterday's version was made is in both SOAPs, so it is not a change here
 * and does not reach the version.
 *
 * Pure. Never touches either SOAP; the result is a new version's text.
 */

export interface CarryChange {
  /** Lines of yesterday's SOAP that changed (empty for an addition). */
  before: string[];
  /** What they became today (empty for a removal). */
  after: string[];
}

export interface CarryResult {
  text: string;
  applied: CarryChange[];
  pending: CarryChange[];
}

interface Hunk {
  before: string[];
  after: string[];
  /** Unchanged non-blank lines before the hunk, nearest first. */
  prev: string[];
  /** Unchanged non-blank lines after the hunk, nearest first. */
  next: string[];
}

const isBlank = (line: string): boolean => line.trim().length === 0;

/** Lines without trailing spaces, so a stray space is not a change. */
function toLines(text: string): string[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trimEnd());
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** Strip blank lines from both ends. */
function core(lines: readonly string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && isBlank(lines[start]!)) start++;
  while (end > start && isBlank(lines[end - 1]!)) end--;
  return lines.slice(start, end);
}

function hunks(base: string, today: string): Hunk[] {
  const segments = diffSegmentsByLine(
    `${toLines(base).join('\n')}\n`,
    `${toLines(today).join('\n')}\n`,
  );
  // One op per line, so context can be read either side of a hunk.
  const ops: Array<{ type: 'equal' | 'insert' | 'delete'; line: string }> = [];
  for (const segment of segments) {
    const lines = segment.text.split('\n');
    lines.pop(); // every segment ends with a newline (see the trailing '\n' above)
    for (const line of lines) ops.push({ type: segment.type, line });
  }

  const out: Hunk[] = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i]!.type === 'equal') {
      i++;
      continue;
    }
    const start = i;
    const before: string[] = [];
    const after: string[] = [];
    while (i < ops.length && ops[i]!.type !== 'equal') {
      (ops[i]!.type === 'delete' ? before : after).push(ops[i]!.line);
      i++;
    }
    const prev: string[] = [];
    for (let j = start - 1; j >= 0; j--) {
      if (ops[j]!.type === 'equal' && !isBlank(ops[j]!.line)) prev.push(ops[j]!.line);
    }
    const next: string[] = [];
    for (let j = i; j < ops.length; j++) {
      if (ops[j]!.type === 'equal' && !isBlank(ops[j]!.line)) next.push(ops[j]!.line);
    }
    out.push({ before, after, prev, next });
  }
  return out;
}

/** Index of the one version line equal to `line`, else -1 (absent or twice). */
function uniqueLine(target: readonly string[], line: string): number {
  const wanted = line.trim();
  let found = -1;
  for (let k = 0; k < target.length; k++) {
    if (target[k]!.trim() !== wanted) continue;
    if (found !== -1) return -1;
    found = k;
  }
  return found;
}

/** Start of the one run of version lines equal to `run`, else -1. */
function uniqueRun(target: readonly string[], run: readonly string[]): number {
  let found = -1;
  for (let k = 0; k + run.length <= target.length; k++) {
    if (!run.every((line, offset) => target[k + offset]!.trim() === line.trim())) continue;
    if (found !== -1) return -1;
    found = k;
  }
  return found;
}

const escapeRe = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The one place `needle` sits inside a version line, bounded so `PLT 20` is
 * not found inside `PLT 209`. Short needles are refused: `- ` or `S:` would
 * match anywhere.
 */
function uniqueInside(
  target: readonly string[],
  needle: string,
): { line: number; index: number } | null {
  const wanted = needle.trim();
  if (wanted.length < 4) return null;
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(wanted)}(?![\\p{L}\\p{N}])`, 'gu');
  let hit: { line: number; index: number } | null = null;
  for (let k = 0; k < target.length; k++) {
    for (const match of target[k]!.matchAll(re)) {
      if (hit) return null;
      hit = { line: k, index: (match.index ?? 0) + match[1]!.length };
    }
  }
  return hit;
}

/**
 * An anchor line in the version: equal to `line`, or starting with it and a
 * space (a heading whose one-line body the version folded onto it).
 */
function anchorIndex(target: readonly string[], line: string): number | 'ambiguous' | 'absent' {
  const wanted = line.trim();
  if (wanted.length < 3) return 'absent';
  let found = -1;
  for (let k = 0; k < target.length; k++) {
    const candidate = target[k]!.trim();
    if (candidate !== wanted && !candidate.startsWith(`${wanted} `)) continue;
    if (found !== -1) return 'ambiguous';
    found = k;
  }
  return found === -1 ? 'absent' : found;
}

/**
 * The nearest neighbour the version still has. Walks past neighbours the
 * version left out (there is nothing to sit beside), stops at one it has
 * twice (no telling which).
 */
function firstAnchor(target: readonly string[], neighbours: readonly string[]): number {
  for (const line of neighbours) {
    const at = anchorIndex(target, line);
    if (at === 'ambiguous') return -1;
    if (at !== 'absent') return at;
  }
  return -1;
}

function insert(target: string[], hunk: Hunk, added: string[]): boolean {
  // A block set off by blank lines (a new EKG) goes ABOVE what followed it; a
  // line inside a list (a new drug) goes BELOW what preceded it.
  const separated = added.length !== hunk.after.length;
  const order = separated ? (['next', 'prev'] as const) : (['prev', 'next'] as const);

  for (const side of order) {
    const at = firstAnchor(target, side === 'next' ? hunk.next : hunk.prev);
    if (at === -1) continue;
    if (side === 'next') {
      const lines = separated
        ? [...(at > 0 && !isBlank(target[at - 1]!) ? [''] : []), ...added, '']
        : added;
      target.splice(at, 0, ...lines);
    } else {
      const lines = separated
        ? ['', ...added, ...(at + 1 < target.length && !isBlank(target[at + 1]!) ? [''] : [])]
        : added;
      target.splice(at + 1, 0, ...lines);
    }
    return true;
  }
  return false;
}

/** Remove lines, and the blank line a removed block leaves doubled. */
function remove(target: string[], at: number, count: number): void {
  target.splice(at, count);
  if (at > 0 && at < target.length && isBlank(target[at - 1]!) && isBlank(target[at]!)) {
    target.splice(at, 1);
  }
}

export function carryVersion(
  yesterdaySoap: string,
  yesterdayVersion: string,
  todaySoap: string,
): CarryResult {
  const target = toLines(yesterdayVersion);
  const applied: CarryChange[] = [];
  const pending: CarryChange[] = [];

  for (const hunk of hunks(yesterdaySoap, todaySoap)) {
    const removed = core(hunk.before);
    const added = core(hunk.after);
    const change: CarryChange = { before: removed, after: added };
    if (removed.length === 0 && added.length === 0) continue; // blank lines only

    // 3. Added only.
    if (removed.length === 0) {
      (insert(target, hunk, added) ? applied : pending).push(change);
      continue;
    }

    // 1. Whole lines, found once.
    const run = uniqueRun(target, removed);
    if (run !== -1) {
      if (added.length > 0) target.splice(run, removed.length, ...added);
      else remove(target, run, removed.length);
      applied.push(change);
      continue;
    }

    // 2. Line for line, each found once (as a line, or inside one).
    if (removed.length === added.length) {
      removed.forEach((old, k) => {
        const next = added[k]!;
        if (isBlank(old) && isBlank(next)) return;
        const pair: CarryChange = { before: [old], after: [next] };
        const line = uniqueLine(target, old);
        if (line !== -1) {
          target[line] = next;
          applied.push(pair);
          return;
        }
        const inside = uniqueInside(target, old);
        if (inside) {
          const text = target[inside.line]!;
          target[inside.line] =
            text.slice(0, inside.index) + next.trim() + text.slice(inside.index + old.trim().length);
          applied.push(pair);
          return;
        }
        pending.push(pair);
      });
      continue;
    }

    pending.push(change);
  }

  return { text: target.join('\n'), applied, pending };
}
