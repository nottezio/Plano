/**
 * CVCU layout → bangsal layout, doing exactly one thing.
 *
 * A CVCU note wraps its objective findings in organ-system headers — Airway,
 * Breathing, Circulation, Disability, Exposure, Fluid, Glucose & Gut,
 * Haematology, Infection. A bangsal note has the same findings without them.
 *
 * So this REMOVES THE HEADERS AND NOTHING ELSE. Order is preserved exactly.
 *
 * The first version did more: it collected vitals to the top, examination
 * findings next, and moved every investigation below them. That is what the
 * bangsal notes look like, so it seemed right — but re-ordering a clinical note
 * means deciding what each line is, and every wrong decision moves a finding to
 * a place it does not belong. It broke notes.
 *
 * Reordering is a judgement. Unwrapping a header is not: the text after it is
 * the same text, in the same order, with one label gone. That is the whole
 * difference between the two layouts that can be made mechanically, and the
 * rest is better done by hand than badly by me.
 */

/** Organ-system headers a CVCU note uses. */
const SYSTEM_HEADERS = [
  'airway',
  'breathing',
  'circulation',
  'disability',
  'exposure',
  'fluid',
  'glucose',
  'glucose & gut',
  'gut',
  'hypo/hyperthermia and haematology',
  'hypo',
  'hyperthermia',
  'haematology',
  'hematology',
  'infection',
];

export interface ReformatResult {
  body: string;
  /** Headers removed, for the preview — the only thing that changed. */
  removed: string[];
}

/**
 * Splits a header from whatever was written after it on the same line.
 *
 * These appear both ways — `*Circulation* :` alone, and
 * `*Airway* : Patent, SpO2 96% on Room Air` with the finding attached. Treating
 * the whole line as a label deletes that finding, which is the one failure this
 * must not have.
 *
 * Returns `null` when the line is not a system header.
 */
function splitSystemHeader(line: string): { name: string; rest: string } | null {
  const colon = line.indexOf(':');

  if (colon === -1) {
    const bare = line.replace(/[*_]/g, '').trim().toLowerCase();
    if (bare.length === 0 || bare.length > 45) return null;
    if (!SYSTEM_HEADERS.some((header) => bare === header || bare.startsWith(`${header} `))) {
      return null;
    }
    return { name: line.trim(), rest: '' };
  }

  const name = line.slice(0, colon).replace(/[*_]/g, '').trim().toLowerCase();
  if (name.length === 0 || name.length > 45) return null;
  if (!SYSTEM_HEADERS.some((header) => name === header || name.startsWith(header))) return null;

  return { name: line.slice(0, colon).trim(), rest: line.slice(colon + 1).trim() };
}

/**
 * Only lines inside the O section are considered.
 *
 * `Infection` and `Fluid` are ordinary words; outside O they could plausibly
 * begin a real line, and unwrapping one there would silently edit a finding.
 */
function objectiveBounds(lines: readonly string[]): { start: number; end: number } | null {
  const start = lines.findIndex((line) => /^\s*\*?\s*O\s*[:/]/i.test(line));
  if (start === -1) return null;

  const end = lines.findIndex(
    (line, index) =>
      index > start &&
      (/^\s*\*?\s*(A|P)\s*[:/]/i.test(line) ||
        /mohon i[zj]in kami (assess|terapi)/i.test(line) ||
        /^\s*\*?\s*(Plan|Diagnosis)\b/i.test(line)),
  );

  return { start, end: end === -1 ? lines.length : end };
}

export function cvcuToBangsal(body: string): ReformatResult {
  const lines = body.split('\n');
  const bounds = objectiveBounds(lines);
  if (!bounds) return { body, removed: [] };

  const removed: string[] = [];
  const out: string[] = [];

  for (const [index, line] of lines.entries()) {
    const insideObjective = index > bounds.start && index < bounds.end;

    if (!insideObjective) {
      out.push(line);
      continue;
    }

    const header = splitSystemHeader(line);
    if (!header) {
      out.push(line);
      continue;
    }

    removed.push(header.name);
    // The content that shared the line stays, in place. Only the label goes.
    if (header.rest.length > 0) out.push(header.rest);
  }

  return { body: collapseBlankRuns(out).join('\n'), removed };
}

/**
 * Removing a header that stood alone leaves two blank lines where there was
 * one. Three or more never appear in a note that was written by hand, so
 * collapsing to two is safe and leaves paragraphing intact.
 */
function collapseBlankRuns(lines: readonly string[]): string[] {
  const out: string[] = [];
  let blanks = 0;

  for (const line of lines) {
    if (line.trim() === '') {
      blanks += 1;
      if (blanks > 1) continue;
    } else {
      blanks = 0;
    }
    out.push(line);
  }

  return out;
}
