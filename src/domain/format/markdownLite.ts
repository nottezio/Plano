import { looksLikeIdentityLine as isIdentityLine } from '../parsePatient';
import { clinicalStart } from '../identity';
import { aliasesOrDefault } from '../sections/aliases';
import { parseSections } from '../sections/parseSections';
import type { SectionAlias } from '../types';

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
 * arrive as bare text. This puts them back.
 *
 * Deliberately NOT automatic. Applying it on paste would edit text the moment
 * it arrives, and the one time it guessed wrong there would be no way to tell
 * what the original said. It is an action on the toolbar; you look at the
 * result and keep it or undo it.
 *
 * It never touches a line that already carries a marker, so running it twice
 * changes nothing.
 *
 * ---
 *
 * WHERE THE HEADING VOCABULARY COMES FROM, and why it moved.
 *
 * This used to hold its own list of heading regexes — `^(S|O|A|P)\s*[:/]\s*$`,
 * `^Plan\s*:?\s*$`, the `Mohon izin …` sentence, and so on. That made it the
 * THIRD consumer in the codebase deriving "is this a heading" for itself,
 * alongside `parseSections` and the tint layer. `parseSections.ts` already
 * records what happens next: "two consumers deriving 'is this a heading'
 * separately is how they came to disagree."
 *
 * They had. `Asesmen:`, `Terapi:`, `Penunjang:` and `S: Sesak berkurang` were
 * all resolved correctly by the parser and all missed by the private list. And
 * because the alias table is EDITABLE in Settings, the private list could
 * never have kept up: a user adding an alias would have taught the parser a
 * heading that this function still could not see. Divergence was structural,
 * not an oversight.
 *
 * So the vocabulary now comes from `parseSections`, which reads the same alias
 * table Settings writes. Only the shapes the parser genuinely cannot see are
 * still matched here, and they have one thing in common: they carry NO
 * delimiter, so there is nothing for a header rule to key on.
 */

/**
 * Investigation headings, which are a date rather than a label.
 *
 * `EKG PJT Lantai 5 06-08-2026`, `Laboratorium PJT (04-08-2026)`. No colon, so
 * the parser's custom-header rule rejects them by design — a loose rule there
 * invents sections out of prose.
 */
const DATED_INVESTIGATION =
  /^(EKG|Laboratorium|Lab|Foto Thorax|Echo\w*|LUS|Laporan|USG|CT|MRI|Holter|AGD|Urinalisa)\b.*\(?\d{2}[-/]\d{2}[-/]\d{2,4}\)?\s*$/i;

/**
 * A consulting service's block heading: `TS BTKV`, `TS Neurologi`.
 *
 * Uppercase `TS` deliberately — this is how the corpus writes it, and a
 * case-insensitive rule would claim ordinary words.
 */
const TS_HEADING = /^TS\b/;

/**
 * Italic lines that are NOT in the opening zone.
 *
 * `Pemeriksaan fisis dalam batas normal` sits inside O, below the clinical
 * boundary, so the zone rule below cannot reach it. It is a fixed sentence
 * rather than a shape, which is why it is safe to match literally.
 *
 * The DPJP pattern is a fallback for fragments — a section pasted on its own
 * has no identity line, so the zone cannot be established, and a DPJP line
 * should still come out italic.
 */
const ITALIC_PATTERNS: readonly RegExp[] = [
  /^_?DPJP\b.*$/i,
  /^Pasien (dikonsul|dirujuk|rujukan|rencana|datang|masuk)\b.*$/i,
  /^(Rencana|Post|Paska|Pasca) tindakan\b.*$/i,
  /^Pemeriksaan fisis dalam batas normal\.?$/i,
];

/** Leading bullet or quote decoration, which stays OUTSIDE the emphasis. */
const DECORATION = /^([\s>#-]*)(.*)$/;

/**
 * Wraps the header, leaving decoration before it and content after it alone.
 *
 * `S: Sesak berkurang` becomes `*S:* Sesak berkurang`, not
 * `*S: Sesak berkurang*`: the heading is the label, and bolding the subjective
 * complaint along with it is a different claim about the note.
 */
function boldHeader(line: string, header: string): string {
  const rest = line.slice(header.length);
  const trimmed = header.trimEnd();
  const gap = header.slice(trimmed.length);
  const match = DECORATION.exec(trimmed);
  const lead = match?.[1] ?? '';
  const core = match?.[2] ?? trimmed;
  if (!core) return line;
  return `${lead}*${core}*${gap}${rest}`;
}

export function restoreEmphasis(body: string, aliases?: readonly SectionAlias[]): string {
  const table = aliasesOrDefault(aliases);
  /**
   * Only sections the alias table NAMES are emphasised.
   *
   * `custom_*` and `_intro` are left exactly as typed, and that single rule is
   * what keeps `Diagnosis Primer :`, `Diagnosis Sekunder :`, `Problem :` and
   * `Faktor resiko koroner:` plain — all four parse as custom sections, which
   * is what they are: labels inside our note, not headings of it. Confirmed
   * against the seeded templates, which write all four without markers.
   *
   * It also keeps `LVSV : 41,8 mL` and `Tekanan Darah : 120/80 mmHg` plain
   * without needing a rule of their own. They are measurements, they parse as
   * custom, and a note bolding every vital sign is the striping bug the tint
   * layer already had once.
   */
  const known = new Set(table.map((alias) => alias.sectionId));
  const sections = parseSections(body, table);

  const lines = body.split('\n');

  // Header offsets are absolute; map them onto line numbers once rather than
  // re-scanning the body for each line.
  const headerByLine = new Map<number, string>();
  {
    const lineStarts: number[] = [];
    let offset = 0;
    for (const line of lines) {
      lineStarts.push(offset);
      offset += line.length + 1;
    }
    for (const section of sections) {
      if (!section.headerLine || !known.has(section.sectionId)) continue;
      const index = lineStarts.indexOf(section.start);
      if (index >= 0) headerByLine.set(index, section.headerLine);
    }
  }

  /**
   * The opening zone: below the identity line, above the first clinical
   * heading. Every non-empty line in it is italic.
   *
   * This replaced a growing list of sentence patterns — `DPJP …`,
   * `Pasien dikonsulkan untuk …`, `Rencana tindakan : …` — which was always
   * going to be incomplete, and was: `Post Tindakan : …`,
   * `Pasien rujukan dari …` and `Paska tindakan …` are all in the corpus and
   * none of them matched. Adding three more regexes would have fixed those
   * three and missed the next one.
   *
   * The corpus says this is a ZONE, not a vocabulary. Every seeded template
   * puts the same kind of line here and nothing else: who is looking after
   * this patient, and why they are in. Checked against all nine seeds — the
   * span between the identity line and the first clinical heading contains
   * italic lines and blank lines, never anything plain.
   *
   * Bounded at BOTH ends deliberately. The greeting and the reporting sentence
   * sit above the identity line and must stay plain, so the zone opens at the
   * identity rather than at the top of the note.
   */
  const openingItalic = { from: -1, to: -1 };
  {
    const boundary = clinicalStart(sections);
    // No recognised clinical heading means no lower bound, and an unbounded
    // zone would italicise the entire note. Better to do nothing.
    if (boundary > 0) {
      let offset = 0;
      let identity = -1;
      let clinical = -1;
      for (const [index, line] of lines.entries()) {
        if (identity < 0 && isIdentityLine(line)) identity = index;
        if (clinical < 0 && offset >= boundary) clinical = index;
        offset += line.length + 1;
      }
      if (identity >= 0 && clinical > identity + 1) {
        openingItalic.from = identity + 1;
        openingItalic.to = clinical;
      }
    }
  }

  /**
   * Everything from the first `TS` heading belongs to a consulting service.
   *
   * Their block writes its own `Diagnosis:`, `Terapi:` and `Plan:`, and the
   * seeded templates leave all three plain — because they are the TS's, not
   * ours. Emphasising them would make another service's plan look like the
   * one we are sending, in a document whose whole purpose is to state what WE
   * think should happen. `classifyProseHeader` already refuses to claim `A/`
   * and `P/` for the same reason; this is that rule applied to emphasis.
   *
   * The TS heading line itself is still emphasised — it is the boundary, and
   * an unmarked boundary is what makes the block ambiguous in the first place.
   */
  let inTsBlock = false;

  return lines
    .map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      /*
       * Block state is tracked BEFORE the already-marked guard, not after.
       *
       * Tracking it after made the function non-idempotent, and in the worst
       * direction. On a second run `*TS BTKV:* rencana CABG` carries a marker,
       * so the guard skipped the line — and skipping it meant `inTsBlock` was
       * never set, so every heading in the TS block below was then emphasised
       * as if it were ours. Pressing the button twice turned another service's
       * plan into ours, silently.
       *
       * The guard is about whether to WRITE, not about whether to READ. So the
       * markers are stripped for the purpose of recognising the boundary, and
       * the guard applies only to the edit.
       */
      const bare = trimmed.replace(/^[*_]+/, '');
      const isTs = TS_HEADING.test(bare);
      if (isTs) inTsBlock = true;

      // A line already carrying a marker is left alone, which is what makes
      // running this twice a no-op.
      if (trimmed.includes('*') || trimmed.startsWith('_')) return line;

      if (isTs) {
        // `TS BTKV: rencana CABG` parses as a custom section, so the parser
        // hands back `TS BTKV: ` as the header and the rest stays plain.
        // A bare `TS Neurologi` has no delimiter and is a header entire.
        const header = headerByLineOrSelf(sections, lines, index);
        return header ? boldHeader(line, header) : line.replace(trimmed, `*${trimmed}*`);
      }
      if (inTsBlock) return line;

      const header = headerByLine.get(index);
      if (header) return boldHeader(line, header);

      if (isIdentityLine(trimmed)) return line.replace(trimmed, `*${trimmed}*`);
      if (index >= openingItalic.from && index < openingItalic.to) {
        return line.replace(trimmed, `_${trimmed}_`);
      }
      if (DATED_INVESTIGATION.test(trimmed)) return line.replace(trimmed, `*${trimmed}*`);
      if (ITALIC_PATTERNS.some((pattern) => pattern.test(trimmed))) {
        return line.replace(trimmed, `_${trimmed}_`);
      }
      return line;
    })
    .join('\n');
}

/**
 * The header of a TS line, whatever section id the parser gave it.
 *
 * Separate from `headerByLine` because that map is filtered to KNOWN sections
 * and a TS heading is always a custom one — but here the header prefix is
 * exactly what should be emphasised, so the filter has to be bypassed rather
 * than widened.
 */
function headerByLineOrSelf(
  sections: readonly { headerLine: string | null; start: number }[],
  lines: readonly string[],
  index: number,
): string | null {
  let offset = 0;
  for (let i = 0; i < index; i += 1) offset += (lines[i]?.length ?? 0) + 1;
  const section = sections.find((candidate) => candidate.start === offset);
  return section?.headerLine ?? null;
}

/**
 * The bullet an iPhone keyboard inserts, turned back into a hyphen.
 *
 * Separate from `restoreEmphasis` because it is a different decision: this one
 * is safe to run on anything, since `•` at the start of a line is never
 * anything but a bullet.
 */
export function normaliseBullets(body: string): string {
  return (
    body
      .replace(/^([ \t]*)[•‣▪·]\s*/gm, '$1- ')
      /**
       * `* ` at the start of a line is the bullet an iPhone inserts.
       *
       * A heading is `*Mohon izin kami terapi dengan:*` — asterisk immediately
       * against the word. A bullet is `* IVFD NaCl`, with a space. That single
       * space is the whole difference, and it is reliable because bold with a
       * leading space does not render as bold in WhatsApp either.
       */
      .replace(/^([ \t]*)\*[ \t]+/gm, '$1- ')
  );
}
