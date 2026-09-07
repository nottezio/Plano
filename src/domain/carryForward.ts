import { aliasesOrDefault } from './sections/aliases';
import { VITAL_BLANKS } from './templates';
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
      /**
       * Header, then a BLANK LINE.
       *
       * A single newline left `*S:*` sitting directly on top of `*O:*` with
       * nothing between them — technically empty and unusable, because the
       * first thing you do is press Enter to make room. Worse, typing on the
       * line immediately below a header is how content ends up appearing to
       * belong to the section after it.
       *
       * One blank line, not two: the section's own trailing blank lines were
       * part of the text just removed, so this restores the spacing the note
       * had rather than adding to it.
       */
      return `${section.headerLine.replace(/[ \t]+$/, '')}\n\n`;
    })
    .join('');

  /**
   * Vitals are cleared LINE BY LINE, not as a section.
   *
   * `ttv` in the cleared list did nothing, and the reason is structural: real
   * notes have no `TTV:` heading. The vitals are bare labelled lines under
   * `*O:*` — `Tekanan Darah : 160/83 mmHg` parses as its own custom section,
   * not as part of a `ttv` one — so a rule that blanks sections had no section
   * to blank. The setting promised something the note's shape could not
   * deliver, and failed silently, which is the worst way for it to fail:
   * yesterday's blood pressure carried into today's note looking filled in.
   *
   * Each line is replaced with its blank form from the seeded O block rather
   * than having its digits stripped. Stripping would have to know that
   * `reguler` after the pulse is not a number, that `on room air` after SpO2
   * stays, and that `36.7` and `160/83` are shaped differently. Substituting
   * the template line needs to know none of that, and it produces exactly what
   * a fresh note looks like.
   */
  const clearVitals = clearable.has('ttv' as SectionId);
  let vitalsCleared = false;
  const finalBody = !clearVitals
    ? body
    : body
        .split('\n')
        .map((line) => {
          const colon = line.indexOf(':');
          if (colon < 0) return line;
          const label = line.slice(0, colon).trim().toLowerCase();
          const blank = VITAL_BLANKS.get(label);
          // Already blank — nothing to report, and nothing to change.
          if (!blank || line.trimEnd() === blank.trimEnd()) return line;
          vitalsCleared = true;
          // Leading whitespace or bullet is preserved: the line's place in the
          // note is the user's, only its value is ours to reset.
          const lead = /^[\s>#-]*/.exec(line)?.[0] ?? '';
          return `${lead}${blank}`;
        })
        .join('\n');

  if (vitalsCleared && !cleared.includes('Tanda vital')) cleared.push('Tanda vital');

  return { body: finalBody, cleared, verbatim: false };
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
