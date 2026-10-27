import { aliasesOrDefault, customSectionId, labelFor, sectionSortIndex } from './aliases';
import { classifyProseHeader } from './classifyProseHeader';
import { matchInvestigationHeading } from './investigationHeading';
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
  /**
   * Does the header occupy its own line, or does it label a value on it?
   *
   * `*O :*` owns its line — the content is below. `LVSV : 41,8 mL` does not:
   * the label and its value share the line, and it is a FIELD, not a heading.
   *
   * The parser is right to treat both as section starts; that is how
   * `Penunjang: Hb 12` gets grouped. But a consumer that DECORATES headings —
   * the tint bands, the jump bar — must not treat a measurement as one.
   * Without this, every echo line and every vital sign got its own colour
   * band, so a note came out striped across text nobody had marked up.
   *
   * Computed here rather than by each consumer, because two consumers deriving
   * "is this a heading" separately is how they came to disagree: the jump bar
   * filtered these out and the tint layer did not.
   */
  ownsLine: boolean;
  /**
   * The heading line IS the section's content, not a label over it.
   *
   * Set only for the cardiology conclusion of a consult reply ("Saat ini
   * evaluasi Kardiologi … pasien kami assess dengan …"), which is one bolded
   * sentence that both opens the assessment and states it. Everything else —
   * the tint layer, copy, carry-forward — treats it as an ordinary heading
   * that owns its line, which is what it is on screen. The card preview is the
   * one reader that needs the words, and it reads this flag rather than
   * guessing from the heading's length.
   */
  carriesContent?: true;
}

interface HeaderHit {
  start: number;
  headerEnd: number;
  sectionId: SectionId;
  label: string;
  carriesContent?: true;
}

/**
 * The cardiology conclusion of a consult reply.
 *
 *   *_Saat ini evaluasi kardiologi berdasarkan anamnesis, … pasien kami assess
 *     dengan Tachypnea ec Abdominal Pain. …_*
 *   *Saat ini evaluasi Kardiologi berdasarkan anamnesis, … pasien termasuk
 *     kategori Low Risk …*
 *
 * It is our assessment of the patient, written as one bolded sentence rather
 * than under an "A" heading. `MAX_WRAPPED_HEADER_LENGTH` rightly refuses a
 * fully bolded 200-character line as a heading — a bolded sentence is not a
 * label — so this line was never a section at all: it was swallowed into the
 * last investigation above it, the jump bar had no A, and the card preview
 * had no assessment to show.
 *
 * Recognised by its OPENING FORMULA, not by relaxing the length rule. The
 * formula is what makes it unambiguous; relaxing the length would start
 * turning any bolded sentence into a section. Emphasis before it (`*`, `_`,
 * any mix) is allowed, since the two samples wrap it differently.
 */
const KARDIO_CONCLUSION_RE = /^[ \t]*[*_]*[ \t]*saat ini evaluasi\s+kardiologi\b/i;

interface Line {
  start: number;
  text: string;
}

/** Characters allowed to decorate a header, per the SPEC 12.1 pattern. */
const DECORATION = '[\\s>*_#-]{0,4}';
const DELIMITERS = '[:.)]';
/**
 * What a ONE-LETTER alias may be followed by. No full stop.
 *
 * `A`, `S`, `O` and `P` are aliases, and a full stop was an accepted delimiter,
 * so every `A. femoralis: +/-` in a vascular examination opened an assessment
 * section. In a real note that put the pulse findings under Diagnosis in the
 * Ringkas PDF and made `femoralis: +/-` the summary line on the board card —
 * the app confidently reporting a leg pulse as the patient's diagnosis.
 *
 * It is not a one-off. `A.` is arteria, `V.` is vena, `N.` is nervus, and in a
 * lab result `S.` and `P.` open bacterial genus names. A single letter followed
 * by a full stop is an abbreviation far more often than it is a heading, and
 * the shorter the token the weaker the evidence it carries.
 *
 * `:` and `)` stay, because `A:` and `A)` are unambiguous headings, and `A/`
 * keeps working through the self-delimited branch below.
 */
const SHORT_DELIMITERS = '[:)]';
/** An alias short enough that a full stop after it is more likely an
 *  abbreviation than a heading. */
const SHORT_TOKEN = 1;

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
  `^(${DECORATION})([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ /&()-]{0,38}?)` +
  `${TRAILING_MARKERS}[ \\t]*:${TRAILING_MARKERS}[ \\t]*`;

const MAX_CUSTOM_WORDS = 3;
const MAX_CUSTOM_CHARS = 24;
/**
 * A label alone on its line may be a little longer (`Faktor Risiko
 * Kardiovaskular :` is 28 characters; 59 of them in the Lt 4 / Lt 5 exports sat
 * inside the S block unrecognised). Nothing follows the colon, so there is no
 * value it could be the label of; a field with a value keeps the tight limits.
 */
const MAX_OWN_LINE_WORDS = 4;

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

/**
 * A consulting team's block heading written bare: `TS Neuro`, `TS GH/`,
 * `TS Divisi Aritmia :` alone on its line (12.12).
 *
 * ROOT CAUSE of consultants' orders being copied as OUR plan: only the
 * bolded form (`*TS BTKV*`, via the wrapped-header rule) or a colon form was a
 * heading. In the Lt 4 / Lt 5 exports 496 of 500 TS headings are bare, so in
 * 328 of 517 reports the TS A/ P/ I/ ran on inside our Plan block — "Salin
 * Plan" pasted the neurologist's and the surgeon's orders as ours, the jump
 * bar had no TS buttons, and the TS block was tinted as Plan.
 *
 * Literal and short: the whole line, starting with `TS` (no bullet — a "- TS
 * Gizi" list item is a plan line, not a heading), at most five words after
 * it, no digits, an optional trailing `:` or `/`.
 */
const TS_BARE_RE = /^[ \t*_]{0,4}(TS[ \t]+[A-Za-z][A-Za-z .&()'-]{0,40}?)[ \t*_]*[:/]?[ \t*_]*$/i;
const MAX_TS_WORDS = 6;

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
  const shortDelimited: string[] = [];
  /**
   * The "Mohon izin kami … dengan" headings stand on their own line with no
   * colon in the colleague reports (12.12: 80 Terapi and ~90 Assessment
   * headings of 516 reports in the Lt 4/Lt 5 exports were missed for want of
   * a colon). Only these sentence-headings, and only as the whole line: they
   * never occur in prose or inside a TS block. A bare "Plan" was tried too and
   * dropped — TS blocks carry "Plan diagnostik" / "Plan Monitoring" lines of
   * their own, and reading those as the patient's Plan split the TS block
   * (konsulReply jump-bar test).
   */
  const wholeLine: string[] = [];

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
    if (token.endsWith('/')) selfDelimited.push(escapeRegExp(token));
    else if (token.length <= SHORT_TOKEN) shortDelimited.push(escapeRegExp(token));
    else delimited.push(escapeRegExp(token));
    if (/^mohon\s/i.test(token)) wholeLine.push(escapeRegExp(token));
  }

  const branches: string[] = [];
  if (delimited.length > 0) {
    branches.push(
      `(?:${delimited.join('|')})${TRAILING_MARKERS}[ \\t]*${DELIMITERS}${TRAILING_MARKERS}`,
    );
  }
  if (shortDelimited.length > 0) {
    branches.push(
      `(?:${shortDelimited.join('|')})${TRAILING_MARKERS}[ \\t]*${SHORT_DELIMITERS}${TRAILING_MARKERS}`,
    );
  }
  if (wholeLine.length > 0) {
    branches.push(`(?:${wholeLine.join('|')})${TRAILING_MARKERS}[ \\t]*$`);
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
    // A closing mark after a space at line end (`*Mohon izin kami assess dengan: *`)
    // is the heading's, else the line read as heading + content "*" and lost ownsLine.
    pattern: new RegExp(`^(${DECORATION})(${body})[ \\t]*(?:[*_~]{1,2}[ \\t]*$)?`, 'i'),
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
  investigationOk = false,
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

  // Before the wrapped-header rule, which would reject it for its length.
  if (KARDIO_CONCLUSION_RE.test(line.text)) {
    return {
      start: line.start,
      // The whole line: on screen it is a line of its own, and every layer
      // that mirrors the textarea treats it as a heading that owns its line.
      headerEnd: line.start + line.text.length,
      sectionId: 'a',
      label: labelFor('a', aliases),
      carriesContent: true,
    };
  }

  // A fully asterisk-wrapped line is a header in its own right. Checked before
  // the general custom rule because it is the stricter of the two: the whole
  // line must match, so there is nothing for it to false-positive on.
  const wrapped = matchWrappedHeader(line.text);
  if (wrapped) {
    // A wrapped label may still name a KNOWN section — `*Penunjang:*` should
    // land in `penunjang`, not a custom bucket that duplicates it.
    /**
     * Exact first: a wrapped line whose ENTIRE content is an alias token is
     * that section, with or without a delimiter.
     *
     * `matcher.pattern` requires a delimiter after the token, so `*Plan*` —
     * the IGD format's plan heading, written with no colon — matched nothing
     * and fell through to `custom_plan`. The wrapping is already the
     * delimiter: the line is nothing but the label.
     */
    const exactInside = matcher.lookup.get(wrapped.trim().toLowerCase());

    const knownInside = exactInside ? null : matcher.pattern.exec(wrapped);
    const insideId =
      exactInside ??
      (knownInside && knownInside.index === 0
        ? matcher.lookup.get(tokenOf(knownInside[0]).toLowerCase())
        : undefined);

    return {
      start: line.start,
      headerEnd: line.start + line.text.length,
      // Prose headings the exact-token table cannot match — the corpus writes
      // assessment and therapy as sentences with inconsistent spelling. Only
      // consulted when `insideId` already failed, so it can never override a
      // heading the alias table resolves.
      sectionId: insideId ?? classifyProseHeader(wrapped) ?? customSectionId(wrapped),
      label: insideId ? labelFor(insideId, aliases) : wrapped,
    };
  }

  // The same heading without asterisks. Only above the assessment: below it a
  // dated `EKG (05-10-2026)` line is a plan, and it must stay inside the Plan.
  const investigation = investigationOk ? matchInvestigationHeading(line.text) : null;
  if (investigation) {
    return {
      start: line.start,
      headerEnd: line.start + investigation.end,
      sectionId: customSectionId(investigation.label),
      label: investigation.label,
    };
  }

  const consult = TS_BARE_RE.exec(line.text);
  if (consult?.[1] && consult[1].trim().split(/\s+/).length <= MAX_TS_WORDS) {
    const label = consult[1].trim();
    return {
      start: line.start,
      headerEnd: line.start + line.text.length,
      sectionId: customSectionId(label),
      label,
    };
  }

  const custom = new RegExp(CUSTOM_HEADER_SOURCE).exec(line.text);
  if (!custom) return null;

  const token = (custom[2] ?? '').trim();
  if (!token) return null;
  const alone = line.text.slice(custom[0].length).trim() === '';
  if (token.split(/\s+/).length > (alone ? MAX_OWN_LINE_WORDS : MAX_CUSTOM_WORDS)) return null;
  if (token.length > MAX_CUSTOM_CHARS && !alone) return null;
  // `https://…` at the start of a line is a URL, not a section called "https".
  if (line.text.slice(custom[0].length).startsWith('//')) return null;

  const sectionId = classifyProseHeader(token) ?? customSectionId(token);
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
 * `S: 36,5` and `P: 20` inside the O block are suhu and pernapasan, not the
 * Subjektif and Plan headings.
 *
 * The one-letter aliases accept a colon, and without context `P: 20` under O
 * opened a Plan section: the reading was then copied as Plan, the vitals
 * after it were never read or cleared, and yesterday's numbers carried over.
 * A heading is followed by text or nothing; a one-letter label followed on
 * the same line by a number is a field.
 */
function isVitalField(line: Line, hit: HeaderHit): boolean {
  if (hit.sectionId !== 's' && hit.sectionId !== 'p') return false;
  const token = tokenOf(line.text.slice(0, hit.headerEnd - line.start));
  if (token.length !== 1) return false;
  return /^\s*\d/.test(line.text.slice(hit.headerEnd - line.start));
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
  /*
    A bare "Plan" / "Planning" line, no colon (12.12: ~60 of 516 colleague
    reports write it so). Accepted ONLY right after the patient's own Terapi
    or Assessment — the place the SOAP's Plan comes — because TS blocks carry
    bare "Plan diagnostik" / "Plan Monitoring" lines of their own, and a
    context-free rule split those (konsulReply jump-bar test).
  */
  const barePlan = table.some((alias) => alias.sectionId === 'p')
    ? { pattern: new RegExp(`^(${DECORATION})((?:Planning|Plan)${TRAILING_MARKERS}[ \\t]*$)`, 'i'), lookup: new Map<string, SectionId>([['plan', 'p'], ['planning', 'p']]) }
    : null;

  const hits: HeaderHit[] = [];
  /** Inside the O block: from an O/TTV heading until the next known heading. */
  let inObjective = false;
  /*
    The last of OUR headings, and whether a TS block has opened since: a
    "Selesai :" or an EKG heading between Terapi and a bare "Plan" must not
    stop it being our Plan, but a TS block must.
  */
  let lastOwn: SectionId | null = null;
  let inConsult = false;
  for (const line of splitLines(body)) {
    const hit: HeaderHit | null =
      detectHeader(line, matcher, table, !inConsult && lastOwn !== 'a' && lastOwn !== 'terapi' && lastOwn !== 'p') ??
      (barePlan && !inConsult && (lastOwn === 'terapi' || lastOwn === 'a') ? detectHeader(line, barePlan, table) : null);
    if (!hit) continue;
    if (!hit.sectionId.startsWith('custom_')) {
      lastOwn = hit.sectionId;
      inConsult = false;
    } else if (/^TS\s/i.test(hit.label)) inConsult = true;
    if (inObjective && isVitalField(line, hit)) continue;
    if (hit.sectionId === 'o' || hit.sectionId === 'ttv') inObjective = true;
    else if (!hit.sectionId.startsWith('custom_')) inObjective = false;
    hits.push(hit);
  }

  if (hits.length === 0) {
    return [
      {
        sectionId: '_intro',
        label: 'Catatan',
        headerLine: null,
        ownsLine: false,
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
      // `_intro` has no header at all, so there is no heading to decorate.
      ownsLine: false,
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
      // A heading owns its line when nothing but whitespace follows the header
      // prefix before the newline. `*O :*` does; `LVSV : 41,8 mL` does not.
      ownsLine: /^[ \t]*(\n|$)/.test(body.slice(hit.headerEnd)),
      ...(hit.carriesContent ? { carriesContent: true as const } : {}),
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
