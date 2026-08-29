import type { TextEdit } from './markdownLite';

/**
 * The header the shift block writes.
 *
 * The clock time goes on the line BELOW, never in the header. A header of
 * `*SOAP Jaga 14:30:*` parses to the section id `custom_soap_jaga_14_30`, so
 * every shift note in the day would be a different section — no stable tint,
 * no jump target, nothing the alias table could ever name. With the time
 * underneath, the id is `custom_soap_jaga` for all of them.
 */
export const SHIFT_HEADER = '*SOAP Jaga:*';

/**
 * `HH.MM`, not `HH:MM`.
 *
 * A colon after the time reads as another header delimiter to the parser, and
 * the dotted form is what the corpus already uses for times inside notes.
 */
export function formatShiftTime(at: Date): string {
  const hh = String(at.getHours()).padStart(2, '0');
  const mm = String(at.getMinutes()).padStart(2, '0');
  return `Jam ${hh}.${mm}`;
}

/**
 * Append an empty shift note to the end of the day's body.
 *
 * A CHILD of the daily SOAP, in the only sense this parser can express one: a
 * labelled block at the end of the same entry, not a second entry.
 *
 * It is intentionally EMPTY of inner headings. The parser is flat — a section
 * runs until the next header, with no containment — so a `*S:*` written inside
 * this block is not nested under it, it is a SECOND OCCURRENCE of the day's S.
 * Jumps and tints survive that (both take the first occurrence), but
 * `composeCopy` gathers every occurrence, so "send S and O to the chief" would
 * silently merge the morning complaint with the shift complaint into one S.
 * Wrong on the way out, and the note still looks complete.
 *
 * So the block gives you a labelled, timestamped space and no structure inside
 * it. Prose there is safe. If shift notes ever need their own S/O/A/P, that is
 * a parser change, not a template change — see the note in HANDOFF.
 *
 * Always appended at the END, never at the caret: a shift note is a later
 * event, and putting it where the cursor happens to be would interleave it
 * with the morning findings.
 */
export function appendShiftNote(body: string, at: Date): TextEdit {
  const trimmed = body.replace(/\s+$/, '');
  const time = formatShiftTime(at);

  // A blank line before the header, so the block reads as separate rather than
  // as a continuation of whatever the last line was.
  const separator = trimmed.length > 0 ? '\n\n' : '';
  const inserted = `${separator}${SHIFT_HEADER}\n${time}\n`;
  const text = `${trimmed}${inserted}`;

  return {
    text,
    // Caret lands on the empty line under the time, ready to type.
    selectionStart: text.length,
    selectionEnd: text.length,
  };
}
