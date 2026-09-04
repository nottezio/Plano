import { mergeSections, parseSections } from '../sections/parseSections';
import { formatBody, type BulletStyle } from './formatters';
import { findOpeningLine } from '../opening';
import type { OutputFormat, SectionAlias } from '../types';

/**
 * SPEC 12.6 — the short report some DPJPs want as a PDF.
 *
 * Three consultants are reported to this way, and the shape is fixed: staffing
 * lines, the opening block exactly as written, the diagnosis list, and a closing
 * sentence. No S, no O, no therapy, no plan.
 *
 * It is a SELECTION, not a rewrite. Every line comes from the note as typed —
 * the identity and DPJP lines are copied verbatim from the opening block, and
 * the diagnoses come from whatever the parser put in the assessment. A format
 * that regenerated them from fields would drift from the note the moment
 * someone corrected a typo in one place and not the other.
 */

/**
 * Used only when the note carries no closing of its own.
 *
 * The report used to end with this string unconditionally, which meant a note
 * addressed to a Prof went out signed off to "dokter" — the file's own opening
 * comment says a report that regenerates what the note already states will
 * drift from it, and this was that drift.
 */
const FALLBACK_CLOSING = 'Selanjutnya mohon arahan dokter.  Terima kasih dokter';

/**
 * The note's own closing sentence, if it has one.
 *
 * Taken from the END of the body, matched against the closings the user has
 * configured. Position matters as much as the wording: a plan item that says
 * "lapor Prof" is not a sign-off, and only the last non-empty line can be.
 */
function closingFrom(body: string, closings: readonly string[]): string | null {
  const normalise = (value: string): string =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  const lines = body.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = (lines[i] ?? '').trim();
    if (line === '') continue;

    const flat = normalise(line);
    const matches = closings.some((closing) => {
      const target = normalise(closing);
      // `startsWith`: the stored sentence omits the final full stop the note
      // usually carries.
      return target.length > 0 && (flat === target || flat.startsWith(target));
    });
    return matches ? line : null;
  }
  return null;
}

/** Ids whose content is the diagnosis list. */
const DIAGNOSIS_IDS = ['a'];

/**
 * Headings that END the diagnosis list.
 *
 * Without these, a section that runs to the end of the note dragged the therapy
 * and plan in with it. In the corpus the list is always followed by one of
 * these, so the first match is the boundary.
 */
const DIAGNOSIS_END =
  /^\s*\*?\s*(Mohon i[zj]in (kami|pasien)?\s*(kami\s*)?(terapi|inisial terapi)|Plan|Selesai|TS |Terapi|Tabe|Selanjutnya)/im;
// `assessment` and `assess` both appear; `izin kami assessment dengan` is the
// heading the ward actually writes, so matching the verb alone is not enough.
const DIAGNOSIS_KEYWORDS = ['diagnos', 'assess', 'problem', 'masalah'];

export interface PdfReportOptions {
  aliases: readonly SectionAlias[];
  format: OutputFormat;
  bullet?: BulletStyle;
  chief?: string;
  junior?: string;
  /**
   * `Chief :` / `Junior :` at the top. Omitted for reports sent to Telegram,
   * where there is no ward group to tag.
   */
  staffing?: boolean;
  /** `_Jam verifikasi HH.MM WITA_` before the closing sentence. */
  verificationTime?: string;
  /**
   * The user's configured closing sentences, used to recognise the note's own
   * sign-off so the report can reuse it verbatim.
   */
  closings?: readonly string[];
}

/**
 * The opening block: everything from the greeting down to the last line before
 * the first clinical section. That is the greeting, the location line, the
 * identity line, the DPJP lines and the procedure line — the part of the note
 * that identifies the patient, which is precisely what this report needs.
 */
function openingBlock(body: string, aliases: readonly SectionAlias[]): string {
  // The UNMERGED parse: merged sections carry combined text but no offset into
  // the original body, and this needs a boundary, not content.
  const sections = parseSections(body, aliases);
  const firstClinical = sections.find((section) =>
    ['s', 'o', 'ttv', 'penunjang', 'a', 'p', 'terapi'].includes(section.sectionId),
  );

  /**
   * With no clinical heading found, stop at the first blank line after the
   * identity block rather than taking the whole note.
   *
   * `body.length` was the fallback, so a note without an `*S:*`/`*O:*` heading —
   * a consult reply, a KJS report that opens straight into diagnoses — put the
   * ENTIRE SOAP into the "opening" of a report that is supposed to be four
   * lines long. That is the bug where Ringkas copied everything.
   */
  /**
   * The EARLIER of the first clinical heading and the end of the identity
   * block.
   *
   * Taking the clinical heading alone was wrong whenever the first recognised
   * one appears late: a note whose assessment and therapy headings are custom
   * but whose `*Plan:*` is recognised put assessment AND therapy into the
   * opening, because Plan was the first heading the list knew about.
   *
   * The opening is a run of short lines at the top; it cannot extend past the
   * blank line that ends them, whatever comes later.
   */
  const end = firstClinical ? firstClinical.start : fallbackOpeningEnd(body);
  const opening = findOpeningLine(body);

  return body.slice(opening?.start ?? 0, end).trim();
}

/**
 * Where the opening stops when nothing marks it.
 *
 * The opening is the greeting, location, identity and DPJP lines — a run of
 * short lines at the top. It ends at the first blank line that follows a line
 * carrying `RM` or `DPJP`, which is how every real report is laid out.
 */
function fallbackOpeningEnd(body: string): number {
  const lines = body.split('\n');

  // The END of the LAST identity line, not the first blank after the first one.
  // Stopping at the first blank cut the identity off a report whose greeting
  // and identity are separated by one, and the DPJP lines off every report —
  // they come after another blank again.
  let offset = 0;
  let lastIdentityEnd = 0;

  for (const line of lines) {
    const next = offset + line.length + 1;
    if (/\bRM\b|\bDPJP\b|atas nama|dikonsul|dirujuk|Rencana tindakan/i.test(line)) {
      lastIdentityEnd = next;
    }
    offset = next;
  }

  return lastIdentityEnd;
}

function diagnosisBlock(body: string, aliases: readonly SectionAlias[]): string {
  const sections = mergeSections(parseSections(body, aliases));

  const matches = sections.filter((section) => {
    if (DIAGNOSIS_IDS.includes(section.sectionId)) return true;
    const haystack = `${section.sectionId} ${section.label}`.toLowerCase();
    return DIAGNOSIS_KEYWORDS.some((keyword) => haystack.includes(keyword));
  });

  return matches
    .map((section) => {
      const text = section.text;
      const stop = DIAGNOSIS_END.exec(text);
      return (stop ? text.slice(0, stop.index) : text).trim();
    })
    .filter(Boolean)
    .join('\n');
}

export function composePdfReport(body: string, options: PdfReportOptions): string {
  const opening = openingBlock(body, options.aliases);
  const diagnoses = diagnosisBlock(body, options.aliases);

  const parts: string[] = [];

  if (options.staffing !== false) {
    // Left blank on purpose: who is on which shift changes daily and is not in
    // the note. Filling them with a guess would be worse than an obvious gap.
    parts.push(`Chief : ${options.chief ?? ''}`.trimEnd());
    parts.push(`Junior : ${options.junior ?? ''}`.trimEnd());
    parts.push('');
  }

  parts.push(opening, '');
  parts.push(diagnoses ? `*Diagnosis:*\n${diagnoses}` : '*Diagnosis:*');
  parts.push('');

  if (options.verificationTime) {
    /**
     * `_Verifikasi 31-08-2026 07.47_` — date AND time.
     *
     * Was `_Jam verifikasi 07.47 WITA_`. A bare clock time is ambiguous the
     * moment the note is read on any day but the one it was written, and the
     * consultant who asks for this line is asking when the note was verified,
     * which is a moment, not an hour. The zone marker went with it: every
     * reader of this note is in the same one, and it was the only part of the
     * line carrying no information.
     */
    parts.push(`_Verifikasi ${options.verificationTime}_`, '');
  }

  // The note's own words when it has them: this report is addressed to a
  // specific consultant, and they are not all called "dokter".
  parts.push(closingFrom(body, options.closings ?? []) ?? FALLBACK_CLOSING);

  return formatBody(
    parts.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    options.format,
    options.bullet,
  );
}
