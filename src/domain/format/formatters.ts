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

/**
 * Bullets, both spellings.
 *
 * markdown-lite writes `- `, but text pasted in from WhatsApp frequently uses
 * `* ` — people type it, and some keyboards autocorrect to it. Handling only
 * `- ` meant those lines passed through untouched, so a list copied back out
 * arrived with literal asterisks where the bullets should be. That is the
 * "bullet turns into a star, sometimes" case: it depended entirely on which
 * character the original author had typed.
 *
 * `* ` is unambiguous as a bullet because the bold rule requires a non-space
 * immediately after the marker — `*teks*` is bold, `* teks` is a list item.
 */
const BULLET_LINE_RE = /^([ \t]*)[-*] /gm;

/**
 * Single-asterisk bold, as WhatsApp writes it.
 *
 * Stored bodies legitimately contain both spellings — `**x**` when typed with
 * the toolbar, `*x*` when pasted from a chat — and plain text has to strip both.
 *
 * Two guards, and only two, because each has to earn its place:
 *
 *  - `(^|[^\w*])` before the opening marker keeps clinical shorthand intact:
 *    in `Ceftriaxone 2*1 g` the asterisk follows a word character, so it never
 *    matches.
 *  - the span must START with a non-space, which distinguishes `*Tn. Abdullah*`
 *    from the stray asterisk in `nilai * penting`, and a bold marker from a
 *    `* ` bullet.
 *
 * It deliberately does NOT require a non-space at the END: identity lines are
 * written `*Tn.  /  /  tahun / RM *` with placeholders blank, and demanding one
 * on both sides skipped exactly those.
 */
const SINGLE_BOLD_RE = /(^|[^\w*])\*([^\s*][^\n*]*?)\*(?!\w)/g;

/**
 * SPEC 12.3 — WhatsApp.
 *
 * `**b**` → `*b*`, `_i_` unchanged, `~~s~~` → `~s~`, and bullets stay `- `.
 *
 * An earlier version converted `- ` to `• `, reasoning that WhatsApp renders no
 * list syntax so a hyphen would read as a stray dash. Real handovers say
 * otherwise: they are written with hyphens, read with hyphens, and a `•`
 * arriving in the chief's chat is the thing that looks out of place.
 *
 * `* ` bullets are normalised to `- ` so a note assembled from several pasted
 * sources comes out consistent, and so a leading asterisk cannot be mistaken
 * for an unclosed bold marker.
 */
export function toWhatsApp(body: string): string {
  return body
    .replace(BOLD_RE, '*$1*')
    .replace(STRIKE_RE, '~$1~')
    .replace(ITALIC_RE, '$1_$2_')
    .replace(BULLET_LINE_RE, '$1- ');
}

/**
 * Characters that survive a copy but not the paste into SIMGOS.
 *
 * SIMGOS renders in a legacy single-byte encoding, so anything outside it
 * arrives as `?`. The offenders are all characters this app or a phone keyboard
 * introduces without being asked: the bullet the WhatsApp formatter emits,
 * curly quotes from iOS autocorrect, en/em dashes, the ellipsis used in
 * truncation, and non-breaking spaces pasted from web tables.
 *
 * Replaced with ASCII equivalents rather than stripped — a dash carries the
 * same meaning as an en dash, whereas a missing character silently changes a
 * dose range into a number.
 */
const ASCII_FOLD: ReadonlyArray<readonly [RegExp, string]> = [
  [/[\u2022\u25CF\u25AA\u00B7]/g, '-'],
  [/[\u2018\u2019\u201B]/g, "'"],
  [/[\u201C\u201D]/g, '"'],
  [/[\u2013\u2014\u2212]/g, '-'],
  [/\u2026/g, '...'],
  [/[\u00A0\u2007\u202F]/g, ' '],
  [/\u00B0/g, ' derajat '],
  [/[\u2264]/g, '<='],
  [/[\u2265]/g, '>='],
  [/\u00D7/g, 'x'],
];

export function foldToAscii(text: string): string {
  return ASCII_FOLD.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
}

/** Anything left that SIMGOS would render as `?`. */
export function findNonAsciiChars(text: string): string[] {
  // eslint-disable-next-line no-control-regex
  return [...new Set(text.match(/[^\x00-\x7F]/g) ?? [])];
}

/**
 * SPEC 12.3 — plain text for SIMGOS and other systems that show raw characters.
 * Every marker is removed; the words and the line structure survive untouched.
 */
export function toPlain(body: string): string {
  return foldToAscii(
    body
      // `**` first: otherwise the single-asterisk rule would eat one pair of
      // markers and leave the other behind.
      .replace(BOLD_RE, '$1')
      .replace(STRIKE_RE, '$1')
      .replace(SINGLE_BOLD_RE, '$1$2')
      .replace(ITALIC_RE, '$1$2')
      // `* ` bullets become `- `, the spelling plain text has always used.
      .replace(BULLET_LINE_RE, '$1- '),
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
 *
 * `- ` is NOT checked: bullets are meant to survive into WhatsApp unchanged.
 */
export function findMarkdownLeaks(text: string): string[] {
  const leaks: string[] = [];
  if (text.includes('**')) leaks.push('**');
  if (text.includes('~~')) leaks.push('~~');
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
