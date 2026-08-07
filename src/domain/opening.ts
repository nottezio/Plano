/**
 * SPEC 14 — the opening line.
 *
 * Every handover starts with one line carrying two independent things: a
 * greeting whose wording depends on the time of day and on who is reading it,
 * and a reporting sentence whose wording depends on why the patient is being
 * presented. They change for different reasons, so they are edited separately.
 *
 * Everything here operates on the note body as text, because the body IS the
 * message (see templates.ts). No hidden fields, no assembly at copy time — the
 * line you swap is the line that gets sent.
 *
 * All functions are pure and rewrite AT MOST the first non-empty line. Nothing
 * below it is touched, which is what makes it safe to offer on a note that is
 * already half-written.
 */

/** Where the first non-empty line sits in the body. */
export interface OpeningLine {
  start: number;
  end: number;
  text: string;
}

export function findOpeningLine(body: string): OpeningLine | null {
  let offset = 0;

  for (const line of body.split('\n')) {
    if (line.trim().length > 0) {
      return { start: offset, end: offset + line.length, text: line };
    }
    offset += line.length + 1;
  }

  return null;
}

/**
 * Splits the opening line into greeting and the rest.
 *
 * The boundary is the first sentence terminator: openings are written as
 * "<greeting>. <report sentence>". If there is no terminator the whole line is
 * treated as the report and the greeting is empty — better to leave a line
 * alone than to guess a split point inside someone's sentence.
 */
export function splitOpening(line: string): { greeting: string; rest: string } {
  const match = /^(\s*[^.!?]*[.!?])\s*(.*)$/s.exec(line);
  if (!match || !match[2]) return { greeting: '', rest: line.trim() };

  return { greeting: match[1]?.trim() ?? '', rest: match[2].trim() };
}

/** Replaces the greeting, keeping the reporting sentence exactly as written. */
export function replaceGreeting(body: string, greeting: string): string {
  const line = findOpeningLine(body);
  if (!line) return greeting ? `${greeting}\n\n${body}` : body;

  const { rest } = splitOpening(line.text);
  return spliceLine(body, line, joinOpening(greeting, rest));
}

/** Replaces the reporting sentence, keeping whatever greeting is in place. */
export function replaceOpeningSentence(body: string, sentence: string): string {
  const line = findOpeningLine(body);
  if (!line) return sentence ? `${sentence}\n\n${body}` : body;

  const { greeting } = splitOpening(line.text);
  return spliceLine(body, line, joinOpening(greeting, sentence));
}

/** Replaces the whole opening line. */
export function replaceOpeningLine(body: string, text: string): string {
  const line = findOpeningLine(body);
  if (!line) return text ? `${text}\n\n${body}` : body;

  return spliceLine(body, line, text);
}

function joinOpening(greeting: string, rest: string): string {
  if (!greeting) return rest;
  if (!rest) return greeting;
  return `${greeting} ${rest}`;
}

/**
 * Splices by offset rather than rebuilding from split lines, so the body's own
 * line endings, trailing spaces and blank runs below the opening survive
 * untouched. Rebuilding would quietly normalise the rest of the note.
 */
function spliceLine(body: string, line: OpeningLine, replacement: string): string {
  return body.slice(0, line.start) + replacement + body.slice(line.end);
}

/**
 * Suggests a time-appropriate greeting from a list.
 *
 * A suggestion only: which greeting is right depends on who is reading it, and
 * the app has no business deciding that. It merely puts the likely one first.
 */
export function suggestGreetingIndex(greetings: readonly string[], hour: number): number {
  const wanted =
    hour < 11 ? 'pagi' : hour < 15 ? 'siang' : hour < 18 ? 'sore' : 'malam';

  const match = greetings.findIndex((greeting) => greeting.toLowerCase().includes(wanted));
  return match >= 0 ? match : 0;
}
