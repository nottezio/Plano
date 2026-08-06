import { aliasesOrDefault } from './sections/aliases';
import { parseSections } from './sections/parseSections';
import type { SectionAlias, SectionId } from './types';

/**
 * SPEC 10 F4 — "Salin dari hari sebelumnya".
 *
 * Copies the whole body, then blanks the *content* of the configured sections
 * while keeping their headers. Default cleared set is S and Penunjang: those
 * are the two that are actively dangerous to carry forward, because a stale
 * complaint or a stale lab value reads as today's finding.
 *
 * Everything else is copied verbatim. This function is the one place in the
 * app allowed to produce a modified body — and it does so as a *proposal* the
 * user then edits, never as a silent rewrite of a stored note.
 */
export interface CarryForwardResult {
  body: string;
  /** Labels of the sections whose content was blanked, for the summary line. */
  cleared: string[];
  /**
   * True when no section headers were detected, so the body was copied
   * verbatim and nothing could be cleared. The UI must warn in this case —
   * silently duplicating yesterday's labs is the failure mode here.
   */
  verbatim: boolean;
}

export function carryForward(
  previousBody: string,
  clearSectionIds: readonly SectionId[],
  aliases?: readonly SectionAlias[],
): CarryForwardResult {
  const table = aliasesOrDefault(aliases);
  const sections = parseSections(previousBody, table);

  const hasHeaders = sections.some((section) => section.sectionId !== '_intro');
  if (!hasHeaders) {
    return { body: previousBody, cleared: [], verbatim: true };
  }

  // `_intro` is never cleared even if configured: it holds the identity line,
  // and blanking it would drop the only text with no header to restore it by.
  const clearable = new Set<SectionId>(
    clearSectionIds.filter((sectionId): sectionId is SectionId => sectionId !== '_intro'),
  );
  const cleared: string[] = [];

  const body = sections
    .map((section) => {
      const original = previousBody.slice(section.start, section.end);
      if (!clearable.has(section.sectionId) || section.headerLine === null) return original;
      if (section.text.trim().length === 0) return original;

      if (!cleared.includes(section.label)) cleared.push(section.label);
      // Header kept exactly as typed, minus its trailing spaces, then a single
      // newline so the next header still starts its own line.
      return `${section.headerLine.replace(/[ \t]+$/, '')}\n`;
    })
    .join('');

  return { body, cleared, verbatim: false };
}

/** One-line summary shown under the editor after a carry-forward. */
export function carryForwardSummary(result: CarryForwardResult): string {
  if (result.verbatim) {
    return 'Disalin apa adanya — periksa kembali data lama (lab/keluhan).';
  }
  if (result.cleared.length === 0) {
    return 'Disalin dari hari sebelumnya.';
  }
  return `Disalin dari hari sebelumnya. Dikosongkan: ${result.cleared.join(', ')}.`;
}
