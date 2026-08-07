import { aliasesOrDefault, customSectionId, labelFor, sectionSortIndex } from './aliases';
import type { SectionAlias, SectionId } from '../types';

/**
 * SPEC 12.1 — the section parser.
 *
 * THE CONTRACT, in one sentence: this file reads. It never writes.
 *
 * The stored body is one free string the user typed. Every output here is a
 * *view* of it — offsets and slices, never a rewritten copy. There is no
 * normalisation step, no header casing fix, no whitespace tidy, no reordering.
 * SPEC 1.5 lists "the parser rewriting, normalising, or reformatting the
 * stored note body" as forbidden, and the reason is clinical rather than
 * aesthetic: a resident must be able to trust that what they typed at 2am is
 * byte-for-byte what gets copied into the handover at 7am.
 *
 * The losslessness invariant is asserted in the tests:
 *
 *     sections.map(s => body.slice(s.start, s.end)).join('') === body
 *
 * Blocks are contiguous and total. Merging repeated headers into a single
 * logical section is a *separate* function (`mergeSections`) precisely so the
 * invariant above can hold on the primary output.
 */

export interface ParsedSection {
  sectionId: SectionId;
  label: string;
  /**
   * The header prefix only — decoration, alias token, delimiter and the spaces
   * after it, e.g. `"- Penunjang: "`. Null for `_intro`.
   *
   * Content typed after the delimiter on the same line is NOT part of this; it
   * belongs to `text`, per SPEC 12.1. So `headerLine + text` reconstructs the
   * block exactly.
   */
  headerLine: string | null;
  /** Char offsets into the body. `[start, end)` covers header + content. */
  start: number;
  end: number;
  /** Offset where content begins — `start` for `_intro`, else after the header. */
  textStart: number;
  /** Content without the header prefix. Untrimmed: this is a slice, not a copy. */
  text: string;
}

interface HeaderHit {
  start: number;
  headerEnd: number;
  sectionId: SectionId;
  label: string;
}

interface Line {
  start: number;
  text: string;
}

/** Characters allowed to decorate a header, per the SPEC 12.1 pattern. */
const DECORATION = '[\\s>*_#-]{0,4}';
const DELIMITERS = '[:.)]';

/**
 * Inline-format markers that may trail the alias token.
 *
 * Not in the SPEC 12.1 pattern, and it has to be: the toolbar's "Sisipkan
 * bagian" and its Bold button are both shipped features, and a user who bolds
 * a header writes `**Penunjang:**` or `**Penunjang**:`. Under the literal spec
 * regex neither is detected — so bolding a header would silently destroy the
 * quick-copy affordance for that section. Two shipped features cancelling each
 * other out is a defect regardless of what the pattern says.
 */
const TRAILING_MARKERS = '[*_~]{0,2}';

/**
 * Unknown headers (SPEC 12.1: `Konsul:` → `custom_konsul`, never discarded).
 *
 * Tighter than the known-alias pattern on purpose. A loose rule here does not
 * fail safe — it invents sections out of ordinary prose and litters the copy
 * sheet with junk. Hence: must start with a letter, no digits (so `14:30` and
 * `Jam 06:00` are not headers), colon only (so `1. Paracetamol` is not), at
 * most three words, at most 24 characters.
 */
const CUSTOM_HEADER_SOURCE =
  `^(${DECORATION})([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ /&()-]{0,23}?)` +
  `${TRAILING_MARKERS}[ \\t]*:${TRAILING_MARKERS}[ \\t]*`;

const MAX_CUSTOM_WORDS = 3;

/**
 * A line that is ENTIRELY wrapped in asterisks is a header.
 *
 * Notes pasted from WhatsApp use single-asterisk bold, and the section labels
 * in real handovers look like `*EKG PJT Lantai 5 06-08-2026*`,
 * `*Laboratorium PJT (04-08-2026)*`, `*Foto Thorax 28-07-2026*`. Every one of
 * those carries digits and no colon, so `CUSTOM_HEADER_SOURCE` — which forbids
 * both, deliberately, to avoid inventing sections out of prose — rejects all of
 * them. The result was that the investigation stack, the part of the note most
 * worth copying one block at a time, parsed as one undifferentiated blob.
 *
 * This rule is safe precisely because it is so literal: the whole line, nothing
 * outside the markers, and short. Ordinary prose is never fully asterisk-
 * wrapped, and a bolded sentence mid-paragraph does not occupy its own line.
 * Both `*x*` and `**x**` are accepted, since the same note may contain both.
 */
const WRAPPED_HEADER_RE = /^[ \t]*(\*{1,2})([^*\n][^\n]*?)\1[ \t]*$/;

/** Long enough for `*Laporan Angiografi Koroner RS Pelamonia 23/06/2026*`. */
const MAX_WRAPPED_HEADER_LENGTH = 72;

/** Matches a fully wrapped header line, returning its inner label. */
export function matchWrappedHeader(line: string): string | null {
  const match = WRAPPED_HEADER_RE.exec(line);
  if (!match) return null;

  const label = match[2]?.trim() ?? '';
  if (label.length === 0 || label.length > MAX_WRAPPED_HEADER_LENGTH) return null;
  // Must contain a letter — `***` and `* * *` separators are not headers.
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(label)) return null;

  return label;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/**
 * Builds one matcher for all configured aliases.
 *
 * Longest-first ordering matters: without it `Penunjang` would win over
 * `Pemeriksaan Penunjang` and the section would start at the wrong offset.
 *
 * Aliases ending in `/` (`Th/`, the standard Indonesian shorthand for terapi)
 * get an optional delimiter. This is a deliberate extension of the SPEC 12.1
 * pattern: `Th/ Paracetamol` is how residents actually write it, and requiring
 * `Th/:` would mean the most common form of the most-copied section never gets
 * detected. The slash is itself an unambiguous terminator, so this adds no
 * false positives.
 */
interface AliasMatcher {
  pattern: RegExp;
  /** Lowercased alias → sectionId. */
  lookup: Map<string, SectionId>;
}

function buildMatcher(aliases: readonly SectionAlias[]): AliasMatcher {
  const lookup = new Map<string, SectionId>();
  const delimited: string[] = [];
  const selfDelimited: string[] = [];

  const tokens = aliases.flatMap((alias) =>
    alias.aliases
      .map((token) => token.trim())
      .filter(Boolean)
      .map((token) => ({ token, sectionId: alias.sectionId })),
  );

  // Longest first so multi-word aliases win over their own prefixes.
  tokens.sort((a, b) => b.token.length - a.token.length);

  for (const { token, sectionId } of tokens) {
    const key = token.toLowerCase();
    if (!lookup.has(key)) lookup.set(key, sectionId);
    (token.endsWith('/') ? selfDelimited : delimited).push(escapeRegExp(token));
  }

  const branches: string[] = [];
  if (delimited.length > 0) {
    branches.push(
      `(?:${delimited.join('|')})${TRAILING_MARKERS}[ \\t]*${DELIMITERS}${TRAILING_MARKERS}`,
    );
  }
  if (selfDelimited.length > 0) {
    branches.push(
      `(?:${selfDelimited.join('|')})${TRAILING_MARKERS}[ \\t]*(?:${DELIMITERS})?${TRAILING_MARKERS}`,
    );
  }

  // No configured aliases: a pattern that can never match is safer than one
  // built from an empty alternation, which would match the empty string on
  // every line and shred the note into headers.
  const body = branches.length > 0 ? branches.join('|') : '(?!)';

  return {
    pattern: new RegExp(`^(${DECORATION})(${body})[ \\t]*`, 'i'),
    lookup,
  };
}

function splitLines(body: string): Line[] {
  const lines: Line[] = [];
  let cursor = 0;
  for (;;) {
    const newline = body.indexOf('\n', cursor);
    const end = newline === -1 ? body.length : newline;
    lines.push({ start: cursor, text: body.slice(cursor, end) });
    if (newline === -1) break;
    cursor = newline + 1;
  }
  return lines;
}

/** Strips decoration, inline markers and delimiter to recover the alias token. */
function tokenOf(matched: string): string {
  return matched
    .replace(/^[\s>*_#-]{0,4}/, '')
    .replace(/[*_~:.)\s]+$/, '')
    .trim();
}

function detectHeader(
  line: Line,
  matcher: AliasMatcher,
  aliases: readonly SectionAlias[],
): HeaderHit | null {
  const known = matcher.pattern.exec(line.text);
  if (known) {
    const token = tokenOf(known[0]);
    const sectionId = matcher.lookup.get(token.toLowerCase());
    if (sectionId) {
      return {
        start: line.start,
        headerEnd: line.start + known[0].length,
        sectionId,
        label: labelFor(sectionId, aliases),
      };
    }
  }

  // A fully asterisk-wrapped line is a header in its own right. Checked before
  // the general custom rule because it is the stricter of the two: the whole
  // line must match, so there is nothing for it to false-positive on.
  const wrapped = matchWrappedHeader(line.text);
  if (wrapped) {
    // A wrapped label may still name a KNOWN section — `*Penunjang:*` should
    // land in `penunjang`, not a custom bucket that duplicates it.
    const knownInside = matcher.pattern.exec(wrapped);
    const insideId =
      knownInside && knownInside.index === 0
        ? matcher.lookup.get(tokenOf(knownInside[0]).toLowerCase())
        : undefined;

    return {
      start: line.start,
      headerEnd: line.start + line.text.length,
      sectionId: insideId ?? customSectionId(wrapped),
      label: insideId ? labelFor(insideId, aliases) : wrapped,
    };
  }

  const custom = new RegExp(CUSTOM_HEADER_SOURCE).exec(line.text);
  if (!custom) return null;

  const token = (custom[2] ?? '').trim();
  if (!token) return null;
  if (token.split(/\s+/).length > MAX_CUSTOM_WORDS) return null;
  // `https://…` at the start of a line is a URL, not a section called "https".
  if (line.text.slice(custom[0].length).startsWith('//')) return null;

  const sectionId = customSectionId(token);
  return {
    start: line.start,
    headerEnd: line.start + custom[0].length,
    sectionId,
    // Custom sections keep the user's own casing; renaming their words would
    // be the parser editing the note by another route.
    label: token,
  };
}

/**
 * Parses a body into contiguous, total blocks.
 *
 * Zero headers → a single `_intro` section labelled "Catatan" spanning the
 * whole body. Text before the first header is always its own `_intro` block,
 * even when it is only whitespace, because dropping it would break
 * losslessness.
 */
export function parseSections(
  body: string,
  aliases?: readonly SectionAlias[],
): ParsedSection[] {
  const table = aliasesOrDefault(aliases);
  const matcher = buildMatcher(table);

  const hits: HeaderHit[] = [];
  for (const line of splitLines(body)) {
    const hit = detectHeader(line, matcher, table);
    if (hit) hits.push(hit);
  }

  if (hits.length === 0) {
    return [
      {
        sectionId: '_intro',
        label: 'Catatan',
        headerLine: null,
        start: 0,
        end: body.length,
        textStart: 0,
        text: body,
      },
    ];
  }

  const sections: ParsedSection[] = [];
  const firstStart = hits[0]?.start ?? 0;

  if (firstStart > 0) {
    sections.push({
      sectionId: '_intro',
      label: 'Catatan',
      headerLine: null,
      start: 0,
      end: firstStart,
      textStart: 0,
      text: body.slice(0, firstStart),
    });
  }

  hits.forEach((hit, index) => {
    const end = hits[index + 1]?.start ?? body.length;
    sections.push({
      sectionId: hit.sectionId,
      label: hit.label,
      headerLine: body.slice(hit.start, hit.headerEnd),
      start: hit.start,
      end,
      textStart: hit.headerEnd,
      text: body.slice(hit.headerEnd, end),
    });
  });

  return sections;
}

export interface MergedSection {
  sectionId: SectionId;
  label: string;
  /** Every block that carried this sectionId, in the order they appear. */
  blocks: ParsedSection[];
  /** Concatenated content of those blocks, trimmed for output. */
  text: string;
  /** True when the section has nothing but whitespace — skipped when composing. */
  empty: boolean;
}

/**
 * SPEC 12.1 — "Repeated headers → merged into one sectionId in output order,
 * both ranges retained."
 *
 * Separate from `parseSections` because merging makes the output
 * non-contiguous, and the losslessness invariant must hold somewhere
 * unconditionally. `parseSections` is that somewhere; this is the view the
 * copy UI consumes.
 */
export function mergeSections(sections: readonly ParsedSection[]): MergedSection[] {
  const order: SectionId[] = [];
  const byId = new Map<SectionId, ParsedSection[]>();

  for (const section of sections) {
    const existing = byId.get(section.sectionId);
    if (existing) existing.push(section);
    else {
      byId.set(section.sectionId, [section]);
      order.push(section.sectionId);
    }
  }

  return order.map((sectionId) => {
    const blocks = byId.get(sectionId) ?? [];
    const text = blocks
      .map((block) => block.text.trim())
      .filter(Boolean)
      .join('\n');
    return {
      sectionId,
      label: blocks[0]?.label ?? sectionId,
      blocks,
      text,
      empty: text.length === 0,
    };
  });
}

/** Sections a user can pick in the copy sheet: merged, ordered, non-empty. */
export function copyableSections(
  body: string,
  aliases?: readonly SectionAlias[],
): MergedSection[] {
  const table = aliasesOrDefault(aliases);
  const merged = mergeSections(parseSections(body, table));

  return merged
    .filter((section) => !section.empty)
    .sort(
      (a, b) => sectionSortIndex(a.sectionId, table) - sectionSortIndex(b.sectionId, table),
    );
}

/** The section containing a caret offset — powers the gutter copy affordance. */
export function sectionAt(
  sections: readonly ParsedSection[],
  offset: number,
): ParsedSection | null {
  return sections.find((section) => offset >= section.start && offset < section.end) ?? null;
}
