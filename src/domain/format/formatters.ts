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
  return body
    .replace(BOLD_RE, '$1')
    .replace(STRIKE_RE, '$1')
    .replace(ITALIC_RE, '$1$2');
}

/** SPEC 12.3 — markdown-lite is already valid Markdown, so this is identity. */
export function toMarkdown(body: string): string {
  return body;
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
