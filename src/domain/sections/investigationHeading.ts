/**
 * A dated investigation heading written bare: `Laboratorium PJT (09-09-2026)`,
 * `Analisa Gas Darah 14-09-2026 jam 06:29 :`, `EKG IGD PJT Kanan Posterior
 * (11-10-2026 pukul 19.34)`, `Foto Thorax RSUD X (24-09-2026): tidak ada kelainan`.
 *
 * ROOT CAUSE this exists: only the bold form (`*Laboratorium PJT (…)*`) was a
 * heading. The same line typed without asterisks has digits and no colon, which
 * the custom-header rule refuses on purpose, so ~330 lab / EKG / AGD / echo
 * headings in the Lt 4 / Lt 5 exports were plain text. They got no tint, and
 * the parser saw one undifferentiated O block. "Penunjang terbaru saja" had the
 * same hole for every form its own pattern did not spell: a bare date, a time
 * inside the brackets, a note after the date ("onset 6 jam", "Post Lytic").
 *
 * Shape-led, not a keyword scan: the line must OPEN with an investigation word
 * AND carry a date, with only a short label before it and nothing but a time, a
 * short note or a colon after it. Either alone is common in prose.
 */

export interface InvestigationHeading {
  /** The heading as written, without bullets, emphasis marks or the colon. */
  label: string;
  /** The words before the date: what `penunjangKind` reads. */
  stem: string;
  /** ISO date, or null when the year is not a plausible one (a typo like 206). */
  date: string | null;
  /** Where the heading ends in the line: the whole line, or just before inline content. */
  end: number;
}

const OPENS =
  /^(?:ekg|ecg|elektrokardiogra\w*|echo\w*|ekokardiogra\w*|lab\b|laboratorium|foto\b|rontgen|x-?ray|thorax|thoraks|toraks|cxr|ct\b|cta\b|ctca|mri|usg|angiogra\w*|arteriogra\w*|agd\b|analis\w*\s+(?:gas\s+)?darah|urinalis[ae]|kultur|treadmill|tte\b|tee\b|spirometri|lung\s+ultrasound|laporan|hasil\s+(?:konfer|conf)\w*|holter|kateterisasi|biopsi|patologi|histopatologi|bronkoskopi)/i;

const DATE = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2,3})(?!\d)/;
const TIME = /^[ \t]*[;,]?[ \t]*(?:pukul|pkl\.?|jam)?[ \t]*\d{1,2}[.:]\d{2}(?:[ \t]*WITA)?/i;
/** A "(" right before the date, with an optional weekday: `(Senin, `. */
const OPEN_PAREN = /\([ \t]*(?:[A-Za-z]+[ \t]*,[ \t]*)?$/;
/** Words that make the text before the date a sentence, not a label. */
const PROSE = /\b(?:tanggal|tgl|pada|dilakukan|kemarin|tadi|sejak|rencana|hasil\s+\w+\s+(?:dari|pada))\b/i;
const MAX_LABEL_WORDS = 10;
const MAX_NOTE_WORDS = 6;
const MAX_NOTE_CHARS = 40;

export function isoDate(day: string, month: string, year: string): string | null {
  const d = Number(day);
  const m = Number(month);
  const y = year.length === 2 ? 2000 + Number(year) : Number(year);
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function matchInvestigationHeading(line: string): InvestigationHeading | null {
  // No `-` or `•`: a bulleted `- EKG (05-10-2026)` is a list item, usually a plan.
  const lead = /^[ \t>*_~#]{0,6}/.exec(line)?.[0].length ?? 0;
  const rest = line.slice(lead);
  if (!OPENS.test(rest)) return null;

  const dateMatch = DATE.exec(rest);
  if (!dateMatch || dateMatch.index > 90) return null;
  const pre = rest.slice(0, dateMatch.index);
  if (pre.includes(':')) return null;

  const parenthesised = OPEN_PAREN.test(pre);
  const stem = pre.replace(OPEN_PAREN, '').replace(/[ \t,(]+$/, '').trim();
  if (!stem || stem.split(/\s+/).length > MAX_LABEL_WORDS || PROSE.test(stem)) return null;

  let tail = rest.slice(dateMatch.index + dateMatch[0].length);
  tail = tail.replace(TIME, '');
  const closed = /^[ \t]*\)/.test(tail);
  tail = tail.replace(/^[ \t]*\)?[ \t]*[*_~]{0,2}/, '');

  let end: number;
  if (/^[ \t]*[:.]*[ \t]*[*_~]{0,2}[ \t]*$/.test(tail)) {
    end = line.length;
  } else if (/^[ \t]*:/.test(tail)) {
    // Inline result after the colon: the heading stops there, the content stays content.
    const colon = line.length - tail.length + tail.indexOf(':') + 1;
    end = colon + (/^[ \t]*/.exec(line.slice(colon))?.[0].length ?? 0);
  } else {
    // A short note after a bracketed date ("onset 6 jam", "(Post SA 0.5mg)"). Never
    // after a bare date: `Lab 12-10-2026 Hb 12` is a sentence.
    if (!parenthesised && !closed) return null;
    const note = tail.trim();
    if (note.length > MAX_NOTE_CHARS || note.split(/\s+/).length > MAX_NOTE_WORDS || note.includes(':')) {
      return null;
    }
    end = line.length;
  }

  const label = line
    .slice(lead, end)
    .replace(/[ \t]*:[ \t]*$/, '')
    .replace(/[*_~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { label, stem, date: isoDate(dateMatch[1]!, dateMatch[2]!, dateMatch[3]!), end };
}
