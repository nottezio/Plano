/**
 * Instrumentation for the `?` that appears in SIMGOS and nowhere else.
 *
 * WHY THIS EXISTS RATHER THAN ANOTHER FIX
 *
 * The `?` has now been chased through four releases. Each round produced a
 * plausible cause, a fix, and a report that it was still happening — because
 * every one of those causes was reasoned about rather than observed. Two
 * separate captures of the exact text copied out of Plano have now been
 * checked, and both were pure ASCII with no `?` anywhere in them. Whatever
 * introduces it is downstream of Plano's clipboard output.
 *
 * At that point another guess is worth less than a measurement. This turns the
 * question into one the person holding both screens can answer in ten seconds,
 * without a laptop, a console, or a round trip through me.
 *
 * TWO MODES, AND THE SECOND IS THE POINT
 *
 * `auditText` answers "what is in this text" — every character SIMGOS cannot
 * render, with its code point and where it is. That catches the classic case
 * of a copy taken from the WhatsApp preview and pasted into SIMGOS.
 *
 * `comparePaste` answers the harder question: paste what Plano produced AND
 * what SIMGOS ended up storing, and it says where they stop agreeing. If the
 * text going in is clean and the text coming out has a `?`, that localises the
 * fault outside this app conclusively — which is not something more code in
 * here can establish.
 */

/** One character that SIMGOS will not render, and where to find it. */
export interface OffendingChar {
  char: string;
  /** `U+00B0` form, because that is what is searchable. */
  code: string;
  /** 1-based, counted the way an editor counts. */
  line: number;
  column: number;
  /** What it would become in a SIMGOS-bound copy, for the obvious ones. */
  note?: string;
}

/**
 * Named where the ASCII equivalent is not guessable from the code point.
 *
 * Deliberately short. A table of every Unicode name would be a dependency and
 * a scroll; these are the characters that actually turn up in this corpus —
 * the app's own bullet, phone-keyboard punctuation, and the invisible ones.
 */
const NOTES: ReadonlyArray<readonly [RegExp, string]> = [
  [/[\u2022\u25CF\u25AA\u00B7]/, 'bullet — jadi "-" di format plain'],
  [/[\u2018\u2019\u201B\u201C\u201D]/, 'kutip melengkung dari keyboard HP'],
  [/[\u2013\u2014\u2212]/, 'en/em dash — jadi "-"'],
  [/\u2026/, 'ellipsis — jadi "..."'],
  [/\u00B0/, 'derajat — jadi " derajat "'],
  [/[\u2264\u2265]/, 'tanda banding — jadi "<=" / ">="'],
  [/\u00D7/, 'tanda kali — jadi "x"'],
  [/\p{Zs}/u, 'SPASI non-ASCII — tidak terlihat sama sekali'],
  [/[\p{Cf}\u00AD\u180E]/u, 'karakter tak terlihat (zero-width / word joiner)'],
];

function noteFor(char: string): string | undefined {
  return NOTES.find(([pattern]) => pattern.test(char))?.[1];
}

/**
 * Every non-ASCII character in `text`, in the order it appears.
 *
 * Positions are line and column rather than a raw offset, because the person
 * reading this is looking at the same text in another window and needs to find
 * it there. A character offset into a 200-line note is not findable by hand.
 *
 * Newlines are not counted as offenders — they are ASCII — but they are what
 * the line numbers are counted from, so `\r\n` and `\n` both advance the line
 * exactly once.
 */
export function auditText(text: string): OffendingChar[] {
  const found: OffendingChar[] = [];
  let line = 1;
  let column = 1;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] as string;

    if (char === '\n') {
      line += 1;
      column = 1;
      continue;
    }
    // A CR is invisible and ASCII; it must not advance the line on its own or
    // every line number in a Windows paste would be doubled.
    if (char === '\r') continue;

    if (char.charCodeAt(0) > 127) {
      const entry: OffendingChar = {
        char,
        code: `U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`,
        line,
        column,
      };
      const note = noteFor(char);
      found.push(note ? { ...entry, note } : entry);
    }

    column += 1;
  }

  return found;
}

/** Literal `?` characters, which are ASCII and so invisible to `auditText`. */
export function findQuestionMarks(text: string): Array<{ line: number; column: number; context: string }> {
  const hits: Array<{ line: number; column: number; context: string }> = [];
  let line = 1;
  let column = 1;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] as string;
    if (char === '\n') {
      line += 1;
      column = 1;
      continue;
    }
    if (char === '\r') continue;
    if (char === '?') {
      hits.push({
        line,
        column,
        // Enough either side to recognise the spot in the other window.
        context: text.slice(Math.max(0, index - 24), index + 12).replace(/\n/g, ' '),
      });
    }
    column += 1;
  }

  return hits;
}

export interface PasteComparison {
  /** True when the two texts are identical after newline normalisation. */
  identical: boolean;
  /** 1-based line where they first differ, or null when they do not. */
  firstDiffLine: number | null;
  before: string | null;
  after: string | null;
  /** Lines that differ, capped — a full diff is not what this is for. */
  changedLines: Array<{ line: number; before: string; after: string }>;
}

/**
 * Compare what Plano produced with what came back out of the other system.
 *
 * Newlines are normalised first and trailing whitespace is ignored per line.
 * Windows will turn `\n` into `\r\n` on the way through any text field, and a
 * diff that reports every single line as changed for that reason tells you
 * nothing.
 *
 * Capped at 20 changed lines. Past that the two texts are not versions of each
 * other and a longer list is not more informative — it is a wall.
 */
export function comparePaste(sent: string, received: string): PasteComparison {
  const split = (text: string): string[] => text.replace(/\r\n?/g, '\n').split('\n');
  const a = split(sent);
  const b = split(received);
  const changed: PasteComparison['changedLines'] = [];
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const before = (a[index] ?? '').trimEnd();
    const after = (b[index] ?? '').trimEnd();
    if (before === after) continue;
    if (changed.length < 20) changed.push({ line: index + 1, before, after });
  }

  const first = changed[0];
  return {
    identical: changed.length === 0,
    firstDiffLine: first ? first.line : null,
    before: first ? first.before : null,
    after: first ? first.after : null,
    changedLines: changed,
  };
}
