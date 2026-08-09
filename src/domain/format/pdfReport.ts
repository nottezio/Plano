import { mergeSections, parseSections } from '../sections/parseSections';
import { formatBody } from './formatters';
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

const CLOSING = 'Selanjutnya mohon arahan dokter.  Terima kasih dokter';

/** Ids whose content is the diagnosis list. */
const DIAGNOSIS_IDS = ['a'];
const DIAGNOSIS_KEYWORDS = ['diagnos', 'assess', 'problem'];

export interface PdfReportOptions {
  aliases: readonly SectionAlias[];
  format: OutputFormat;
  chief?: string;
  junior?: string;
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

  const end = firstClinical ? firstClinical.start : body.length;
  const opening = findOpeningLine(body);

  return body.slice(opening?.start ?? 0, end).trim();
}

function diagnosisBlock(body: string, aliases: readonly SectionAlias[]): string {
  const sections = mergeSections(parseSections(body, aliases));

  const matches = sections.filter((section) => {
    if (DIAGNOSIS_IDS.includes(section.sectionId)) return true;
    const haystack = `${section.sectionId} ${section.label}`.toLowerCase();
    return DIAGNOSIS_KEYWORDS.some((keyword) => haystack.includes(keyword));
  });

  return matches
    .map((section) => section.text.trim())
    .filter(Boolean)
    .join('\n');
}

export function composePdfReport(body: string, options: PdfReportOptions): string {
  const opening = openingBlock(body, options.aliases);
  const diagnoses = diagnosisBlock(body, options.aliases);

  const parts = [
    // Left blank on purpose: who is on which shift changes daily and is not in
    // the note. Filling them with a guess would be worse than an obvious gap.
    `Chief : ${options.chief ?? ''}`.trimEnd(),
    `Junior : ${options.junior ?? ''}`.trimEnd(),
    '',
    opening,
    '',
    diagnoses ? `*Diagnosis:*\n${diagnoses}` : '*Diagnosis:*',
    '',
    CLOSING,
  ];

  return formatBody(parts.join('\n').replace(/\n{3,}/g, '\n\n').trim(), options.format);
}
