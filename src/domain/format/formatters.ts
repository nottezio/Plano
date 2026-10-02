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
/**
 * WhatsApp's compose box turns a line starting `- ` into its own bullet list.
 *
 * That conversion is WANTED: it is how a handover renders in the chat, and it
 * is why the default emits a plain hyphen and gets out of the way. I spent two
 * releases defeating it — first by writing `•` myself, then with invisible
 * guard characters — on the assumption that an app changing the text after a
 * paste was a bug. It was the feature.
 *
 * The guards below remain as an option for the opposite preference, which is a
 * real one: someone pasting into a system that shows `- ` literally.
 */
const NBSP = '\u00A0';

/**
 * Zero-width space, placed BEFORE the hyphen.
 *
 * A non-breaking space after the hyphen was not enough: WhatsApp's compose box
 * still recognises a line that begins with `-` and turns it into its own list.
 * The only reliable defeat is for the line not to begin with a hyphen at all.
 *
 * A zero-width space is invisible and occupies no width, so the pasted line
 * looks exactly as typed while no longer matching the list pattern. It is
 * folded back out for SIMGOS along with the other non-ASCII characters.
 */
const ZWSP = '\u200B';

export type BulletStyle = 'hyphen' | 'guarded' | 'bullet';

/**
 * Invisible characters, removed from EVERY format rather than only plain text.
 *
 * `toPlain` has guaranteed ASCII for a while, but a `?` kept appearing in
 * SIMGOS — because the text was copied as WhatsApp format, where the fold never
 * ran. The invisible ones (word joiner, zero-width space, BOM) are the culprits
 * and they carry no meaning anywhere, so stripping them everywhere loses
 * nothing.
 *
 * Visible non-ASCII — `é`, `°` — is left alone outside plain text, because
 * WhatsApp renders it correctly and folding it there would be a loss.
 */
/**
 * Non-ASCII whitespace, folded to a plain space in EVERY format.
 *
 * The second half of the same bug. `\p{Cf}` above covers characters that are
 * invisible because they have no glyph. It does NOT cover characters that are
 * invisible because they look *exactly like a space*: NBSP (U+00A0), narrow
 * NBSP (U+202F), thin/hair/en/em space, ideographic space. Those are category
 * `Zs`, not `Cf`, so `stripInvisible` passed them straight through — and a
 * note copied as WhatsApp format carried them into SIMGOS, which rendered each
 * one as `?`.
 *
 * That is why the `?` was unfindable by eye: there is nothing to see. The
 * fold only ran in `toPlain`, so the identical note copied one way was clean
 * and copied the other way was not.
 *
 * Category `\p{Zs}`, not a list of code points, for the reason recorded on
 * `foldToAscii`: an explicit list is always one character behind the next
 * source. It includes ordinary U+0020, where the replacement is a no-op.
 *
 * Replaced with a space, never removed — `Nadi 73` with a thin space must not
 * become `Nadi73`.
 *
 * `\p{Zl}`/`\p{Zp}` (U+2028 line separator, U+2029 paragraph separator) become
 * newlines for the same reason they do in `foldToAscii`: invisible, non-ASCII,
 * and they silently join two lines into one if left alone.
 */
export function stripInvisible(text: string): string {
  return text
    .replace(/[\u00AD\u180E]/gu, '')
    .replace(/\p{Cf}/gu, '')
    .replace(/[\p{Zl}\p{Zp}]/gu, '\n')
    .replace(/\p{Zs}/gu, ' ');
}

export function toWhatsApp(body: string, bullet: BulletStyle = 'hyphen'): string {
  const marker =
    bullet === 'bullet'
      ? '• '
      : bullet === 'guarded'
        ? // Both guards together: the line no longer STARTS with a hyphen, and
          // the space after it is not an ordinary one either.
          `${ZWSP}-${NBSP}`
        : '- ';

  // Invisible characters go first: the guarded bullet style inserts its own
  // deliberately, and stripping after would remove them again.
  return stripInvisible(body)
    .replace(BOLD_RE, '*$1*')
    .replace(STRIKE_RE, '~$1~')
    .replace(ITALIC_RE, '$1_$2_')
    .replace(BULLET_LINE_RE, `$1${marker}`);
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
  // Category, not a list. This used to name three code points (U+00A0,
  // U+2007, U+202F) and missed the thin, hair, en, em and ideographic spaces
  // entirely — they fell through to step 4 and were *removed*, joining the
  // words either side. `\p{Zs}` covers every space separator Unicode defines.
  [/\p{Zs}/gu, ' '],
  /**
   * Invisible formatting characters, removed rather than replaced.
   *
   * The listed set was not enough. Text pasted from WhatsApp carries U+2060
   * WORD JOINER after each bullet — invisible in every editor, and the `?` that
   * kept appearing in SIMGOS. An explicit list will always be one character
   * behind the next source, so this is the whole Unicode "format" category
   * (`\p{Cf}`) plus the soft hyphen and Mongolian vowel separator, which are
   * not in it but behave the same way.
   *
   * Replacing them with a space would be wrong: they occupy no width, so a
   * space would shift every line they appear in.
   */
  [/[\u00AD\u180E]/gu, ''],
  [/\p{Cf}/gu, ''],
  [/\u00B0/g, ' derajat '],
  [/[\u2264]/g, '<='],
  [/[\u2265]/g, '>='],
  [/\u00D7/g, 'x'],
];

/**
 * Characters whose plain decomposition CHANGES A NUMBER.
 *
 * NFKD (step 2 below) turns `½` into `1`, U+2044 FRACTION SLASH, `2`, and
 * step 4 then removed the slash: `½ tab` reached SIMGOS as `12 tab`, and
 * `1½` as `112`. Superscripts decompose to bare digits, so `10³/µL` became
 * `103/uL`. Neither is a lost symbol — both are a different dose or count,
 * written without any sign that something happened.
 *
 * So these are spelled out BEFORE decomposition, unconditionally: unlike the
 * symbol words below, there is no setting under which a changed number is
 * acceptable.
 */
const VULGAR_FRACTIONS: Readonly<Record<string, string>> = {
  '\u00BD': '1/2', '\u00BC': '1/4', '\u00BE': '3/4',
  '\u2153': '1/3', '\u2154': '2/3', '\u2155': '1/5', '\u2156': '2/5',
  '\u2157': '3/5', '\u2158': '4/5', '\u2159': '1/6', '\u215A': '5/6',
  '\u2150': '1/7', '\u2151': '1/9', '\u2152': '1/10',
  '\u215B': '1/8', '\u215C': '3/8', '\u215D': '5/8', '\u215E': '7/8',
};
const VULGAR_RE = /(\d?)([\u00BC-\u00BE\u2150-\u215E])/g;
const SUPERSCRIPTS: Readonly<Record<string, string>> = {
  '\u2070': '0', '\u00B9': '1', '\u00B2': '2', '\u00B3': '3', '\u2074': '4',
  '\u2075': '5', '\u2076': '6', '\u2077': '7', '\u2078': '8', '\u2079': '9',
  '\u207A': '+', '\u207B': '-',
};
const SUPERSCRIPT_RE = /[\u2070\u00B9\u00B2\u00B3\u2074-\u2079\u207A\u207B]+/g;

function spellNumbers(text: string): string {
  return text
    .replace(VULGAR_RE, (_, whole: string, fraction: string) =>
      `${whole ? `${whole} ` : ''}${VULGAR_FRACTIONS[fraction] ?? fraction}`,
    )
    .replace(SUPERSCRIPT_RE, (run) => `^${[...run].map((c) => SUPERSCRIPTS[c] ?? c).join('')}`);
}

/**
 * Symbols with an ASCII spelling, for SIMGOS (Salin → Teks polos, on by
 * default, switchable in the sheet).
 *
 * Without this, step 4 of `foldToAscii` DELETES them: `Troponin ↑` arrived as
 * `Troponin `, `Aspilet → CPG` as `Aspilet  CPG`, `β-blocker` as `-blocker`.
 * Nothing in the result says a word is missing, which is the worst way for a
 * note to be wrong.
 *
 * Ordered: `µg` before `µ`, so a dose reads `mcg` (the spelling that cannot be
 * misread as `mg`) and anything else micro- reads `u`. Word replacements are
 * padded with a space where they would otherwise fuse with a letter or digit —
 * `K 3,1↓` → `K 3,1 (turun)`, never `3,1(turun)` glued to the next token.
 *
 * The arrows' words are Indonesian because the note is; the Greek letters are
 * spelled the way the drug classes are written in the notes (`beta blocker`).
 */
export const SYMBOL_ASCII: ReadonlyArray<readonly [string, string]> = [
  ['\u2192', '->'], ['\u27F6', '->'], ['\u2794', '->'], ['\u279C', '->'], ['\u279D', '->'], ['\u21FE', '->'],
  ['\u2190', '<-'], ['\u27F5', '<-'],
  ['\u2194', '<->'], ['\u27F7', '<->'],
  ['\u21D2', '=>'], ['\u27F9', '=>'], ['\u21D4', '<=>'],
  ['\u2191', '(naik)'], ['\u2B06', '(naik)'], ['\u21E7', '(naik)'],
  ['\u2193', '(turun)'], ['\u2B07', '(turun)'], ['\u21E9', '(turun)'],
  ['\u00B1', '+/-'], ['\u2213', '-/+'],
  ['\u00B5g', 'mcg'], ['\u03BCg', 'mcg'], ['\u00B5', 'u'], ['\u03BC', 'u'],
  ['\u2248', '~'], ['\u223C', '~'], ['\u2243', '~'],
  ['\u2260', '=/='], ['\u00F7', '/'],
  ['\u03B1', 'alpha'], ['\u03B2', 'beta'], ['\u03B3', 'gamma'],
  ['\u0394', 'delta'], ['\u03B4', 'delta'], ['\u03BA', 'kappa'], ['\u03BB', 'lambda'],
  ['\u2713', '(v)'], ['\u2714', '(v)'], ['\u2611', '(v)'], ['\u221A', '(v)'],
  ['\u2717', '(x)'], ['\u2718', '(x)'], ['\u2612', '(x)'], ['\u2715', '(x)'],
  ['\u2642', '(L)'], ['\u2640', '(P)'],
];

const SYMBOL_RE = new RegExp(
  SYMBOL_ASCII.map(([symbol]) => symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'gu',
);
const SYMBOL_MAP = new Map(SYMBOL_ASCII);
const PADDED = /^\(/;

/** Replace every symbol `SYMBOL_ASCII` knows; anything else is left alone. */
export function symbolsToAscii(text: string): string {
  return text.replace(SYMBOL_RE, (symbol, offset: number, whole: string) => {
    const ascii = SYMBOL_MAP.get(symbol) ?? symbol;
    if (!PADDED.test(ascii)) return ascii;
    const before = whole[offset - 1] ?? '';
    const after = whole[offset + symbol.length] ?? '';
    return `${/[\p{L}\p{N}]/u.test(before) ? ' ' : ''}${ascii}${/[\p{L}\p{N}]/u.test(after) ? ' ' : ''}`;
  });
}

/**
 * Which symbols a text holds that `symbolsToAscii` would rewrite, with counts,
 * in first-seen order — the sheet's "what changed" line.
 */
export function findConvertibleSymbols(
  text: string,
): Array<{ symbol: string; ascii: string; count: number }> {
  const found = new Map<string, number>();
  for (const match of text.matchAll(SYMBOL_RE)) {
    found.set(match[0], (found.get(match[0]) ?? 0) + 1);
  }
  return [...found].map(([symbol, count]) => ({
    symbol,
    ascii: SYMBOL_MAP.get(symbol) ?? symbol,
    count,
  }));
}

export interface AsciiOptions {
  /**
   * Spell known symbols in ASCII (`→` → `->`) instead of deleting them.
   * Default ON: deleting is never the better outcome, and the only reason to
   * turn it off is to see what the plain fold alone would do.
   */
  asciiSymbols?: boolean | undefined;
}

/**
 * Guarantees the output is pure ASCII, rather than handling known offenders.
 *
 * Three releases running I fixed this one character at a time — the bullet,
 * then the curly quotes, then U+2060. Each fix was correct and each was
 * followed by another character I had not thought of, because an explicit list
 * is always one behind whatever the next paste contains.
 *
 * So the last step is now a guarantee instead of a list:
 *
 *  1. Named replacements first, where the ASCII equivalent carries meaning
 *     (`°` → ` derajat `, `≥` → `>=`).
 *  2. NFKD decomposition then drops combining marks, so `é` becomes `e` rather
 *     than disappearing — a name is still readable, which matters more than
 *     being exactly right.
 *  3. Line and paragraph separators become newlines; they are invisible and
 *     would otherwise join two lines into one.
 *  4. Anything still outside ASCII is removed.
 *
 * Step 4 is what makes this final. There is a test asserting the output of
 * `toPlain` contains no non-ASCII character at all, for any input.
 */
export function foldToAscii(text: string, options: AsciiOptions = {}): string {
  const symbols = options.asciiSymbols ?? true;
  const named = ASCII_FOLD.reduce(
    (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
    spellNumbers(symbols ? symbolsToAscii(text) : text),
  );

  return named
    .normalize('NFKD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[\u2028\u2029]/g, '\n')
    // What NFKD makes of the fractions not in the named list (`⅐` → `1⁄7`).
    .replace(/\u2044/g, '/')
    .replace(/[^\x00-\x7F]/g, '');
}

/** Anything left that SIMGOS would render as `?`. */
export function findNonAsciiChars(text: string): string[] {
  return [...new Set(text.match(/[^\x00-\x7F]/g) ?? [])];
}

/**
 * SPEC 12.3 — plain text for SIMGOS and other systems that show raw characters.
 * Every marker is removed; the words and the line structure survive untouched.
 */
export function toPlain(body: string, options: AsciiOptions = {}): string {
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
    options,
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
  return stripInvisible(body).replace(SINGLE_BOLD_RE, '$1**$2**');
}

export function formatBody(
  body: string,
  format: OutputFormat,
  bullet: BulletStyle = 'hyphen',
  ascii: AsciiOptions = {},
): string {
  switch (format) {
    case 'whatsapp':
      return toWhatsApp(body, bullet);
    case 'plain':
      return toPlain(body, ascii);
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
