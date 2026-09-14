/**
 * Move finished drugs out of the active therapy list into `Selesai:`.
 *
 * A CVCU note marks them inline — `• CA Gluconas 10% 30 cc/IV … (selesai)` —
 * because in CVCU the list is a running record of everything given. A bangsal
 * note separates them: the active list is what the nurse is still giving
 * today, and a finished drug sitting in it is an instruction to continue
 * something that has stopped.
 *
 * Taken from the worked CVCU → bangsal pair of 13 September, where this is one
 * of two transforms the earlier reformatter did not do at all.
 *
 * Only the therapy block is touched, and only lines that SAY so. `(selesai)`
 * is the marker; a drug that merely finished in real life but is not marked
 * stays exactly where it is, because the note is the only evidence there is.
 */

const THERAPY_HEADING = /mohon i[zj]in (?:kami )?terapi dengan/i;
const DONE = /\((?:selesai|stop|stopped|dihentikan)\)\s*$/i;

/** A line that starts a section other than the therapy list. */
const SECTION = /^\s*[*_]*\s*(?:Plan|Selesai|A|P|S|O|TS\s|Mohon|Selanjutnya|Terima)/i;

export interface TherapySplit {
  body: string;
  moved: number;
}

export function splitFinishedTherapy(body: string): TherapySplit {
  const lines = body.split('\n');
  const start = lines.findIndex((line) => THERAPY_HEADING.test(line));
  if (start === -1) return { body, moved: 0 };

  // The block runs to the next section heading. A blank line does NOT end it:
  // therapy lists in this corpus are written with blank lines between groups,
  // and stopping at the first one would leave half the list unexamined.
  let end = start + 1;
  while (end < lines.length && !SECTION.test(lines[end] ?? '')) end += 1;

  const active: string[] = [];
  const finished: string[] = [];

  for (const line of lines.slice(start + 1, end)) {
    if (line.trim() && DONE.test(line)) {
      // The marker goes with the move. Under a `Selesai:` heading it is
      // repetition, and repetition is how a heading stops being read.
      finished.push(line.replace(DONE, '').trimEnd());
      continue;
    }
    active.push(line);
  }

  if (finished.length === 0) return { body, moved: 0 };

  // Trailing blanks in the active list would otherwise push `Selesai:` away
  // from the block it belongs to.
  while (active.length > 0 && !active[active.length - 1]?.trim()) active.pop();

  const rebuilt = [
    ...lines.slice(0, start + 1),
    ...active,
    '',
    'Selesai:',
    ...finished,
    ...lines.slice(end),
  ];

  return { body: rebuilt.join('\n'), moved: finished.length };
}

/**
 * `•` and friends become `- `.
 *
 * The bangsal notes use a hyphen throughout and the CVCU ones use a bullet
 * character. It matters beyond looks: `•` is not ASCII, so every one of them
 * reaches SIMGOS as a `?` — the bug chased through four releases in September.
 * Converting here means a reformatted note cannot carry them in.
 */
export function normaliseBullets(body: string): string {
  return body.replace(/^(\s*)[•●▪·*]\s+/gm, '$1- ');
}
