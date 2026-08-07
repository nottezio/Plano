import type { OutputFormat } from '../types';

/**
 * SPEC 12.3 — the formatters.
 *
 * Stored bodies are markdown-lite (`**bold**`, `_italic_`, `~~strike~~`,
 * `- `, `1. `). Each formatter is a pure, total function from that one
 * canonical model to one output. There is no conversion *into* the store and
 * there must never be: the reason the model is canonical is that WhatsApp's
 * `*bold*` and Markdown's `*italic*` are the same character meaning different
 * things, so storing either makes every round-trip lossy.
 *
 * "No markdown leakage" is the acceptance criterion, and it is precise: after
 * `toWhatsApp` there must be no surviving `**`, `~~`, or bare `- ` bullets.
 */

/**
 * Inline patterns.
 *
 * Deliberately no lookbehind anywhere: Safari only gained support in 16.4, and
 * a regex that throws at parse time takes the whole bundle down on older iPads
 * — which is exactly the hardware this app runs on. Left boundaries are
 * captured instead and re-emitted.
 */
const BOLD_RE = /\*\*([^\n*]+?)\*\*/g;
const STRIKE_RE = /~~([^\n~]+?)~~/g;
/**
 * Italic needs word boundaries or `TD_N_RR` and `hari_rawat` become italics.
 * `(^|[^\w*])` captures the preceding character; `(?!\w)` is a plain lookahead.
 */
const ITALIC_RE = /(^|[^\w*])_([^\n_]+?)_(?!\w)/g;

const BULLET_LINE_RE = /^(\s*)- /gm;

/**
 * Single-asterisk bold, as WhatsApp writes it.
 *
 * The parser learned to read `*Header*` last release; the formatters did not,
 * so a note pasted in from WhatsApp copied out to SIMGOS with every asterisk
 * still in it. Stored bodies legitimately contain both spellings — `**x**` when
 * typed with the toolbar, `*x*` when pasted from a chat — and plain text has to
 * strip both.
 *
 * Two guards, and only two, because each one has to earn its place:
 *
 *  - `(^|[^\w*])` before the opening marker keeps clinical shorthand intact —
 *    in `Ceftriaxone 2*1 g` the asterisk follows a word character, so it never
 *    matches.
 *  - the span must START with a non-space, which is what distinguishes
 *    `*Tn. Abdullah*` from the stray asterisk in `nilai * penting`.
 *
 * It deliberately does NOT require the span to END with a non-space. Real
 * identity lines are written `*Tn.  /  /  tahun / RM *` with the placeholder
 * left blank, and an earlier version that demanded a non-space on both sides
 * skipped exactly those — so the patient identity was the one line that copied
 * into SIMGOS with its asterisks still attached.
 *
 * Same no-lookbehind constraint as everywhere else.
 */
const SINGLE_BOLD_RE = /(^|[^\w*])\*([^\s*][^\n*]*?)\*(?!\w)/g;

/**
 * SPEC 12.3 — WhatsApp.
 *
 * `**b**` → `*b*`, `_i_` unchanged, `~~s~~` → `~s~`, `- ` → `• `.
 *
 * Bullets become a literal `•` because WhatsApp renders no list syntax at all:
 * a leading `- ` would paste as a stray hyphen, and on a handover message that
 * reads as a typo rather than a list.
 */
export function toWhatsApp(body: string): string {
  return body
    .replace(BOLD_RE, '*$1*')
    .replace(STRIKE_RE, '~$1~')
    .replace(ITALIC_RE, '$1_$2_')
    .replace(BULLET_LINE_RE, '$1• ');
}

/**
 * SPEC 12.3 — plain text for SIMGOS and other systems that show raw characters.
 * Every marker is removed; the words and the line structure survive untouched.
 */
export function toPlain(body: string): string {
  return (
    body
      // `**` first: otherwise the single-asterisk rule would eat one pair of
      // markers and leave the other behind.
      .replace(BOLD_RE, '$1')
      .replace(STRIKE_RE, '$1')
      .replace(SINGLE_BOLD_RE, '$1$2')
      .replace(ITALIC_RE, '$1$2')
  );
}

/**
 * SPEC 12.3 — Markdown.
 *
 * Almost identity, with one correction: `*x*` means BOLD in WhatsApp and
 * ITALIC in Markdown. Passing it through unchanged would silently reclassify
 * every heading pasted in from a chat, so single-asterisk spans are promoted to
 * `**x**` and keep their intended weight.
 */
export function toMarkdown(body: string): string {
  return body.replace(SINGLE_BOLD_RE, '$1**$2**');
}

export function formatBody(body: string, format: OutputFormat): string {
  switch (format) {
    case 'whatsapp':
      return toWhatsApp(body);
    case 'plain':
      return toPlain(body);
    case 'markdown':
      return toMarkdown(body);
  }
}

export const FORMAT_LABELS: Record<OutputFormat, string> = {
  whatsapp: 'WhatsApp',
  plain: 'Teks polos',
  markdown: 'Markdown',
};

/**
 * Diagnostic used by the tests and by the copy sheet's preview.
 * Any hit here is a leak the acceptance criterion forbids.
 */
export function findMarkdownLeaks(text: string): string[] {
  const leaks: string[] = [];
  if (text.includes('**')) leaks.push('**');
  if (text.includes('~~')) leaks.push('~~');
  if (/^(\s*)- /m.test(text)) leaks.push('- ');
  return leaks;
}

/** Nothing a paste into SIMGOS should carry: no bold, italic or strike markers. */
export function findPlainTextLeaks(text: string): string[] {
  const leaks: string[] = [];
  if (/\*/.test(text)) leaks.push('*');
  if (/~/.test(text)) leaks.push('~');
  if (new RegExp(ITALIC_RE.source).test(text)) leaks.push('_');
  return leaks;
}
