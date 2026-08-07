import type { Patient } from './types';

/**
 * SPEC 1.2 rule 5, applied to identity.
 *
 * The note body is the record. A patient does not need a filled-in form to
 * exist — you tap +, you get a blank page, you paste or type. Everything the
 * board needs to show a card is DERIVED from what was actually written.
 *
 * `name` therefore becomes optional metadata rather than a precondition. When
 * it is set, it wins, because someone typing a name into the identity field
 * meant that name. When it is empty, the first line of the note stands in.
 */

const MAX_TITLE_LENGTH = 60;

/** The first line with any content, trimmed of markdown-lite decoration. */
export function firstMeaningfulLine(body: string): string {
  for (const rawLine of body.split('\n')) {
    const line = rawLine
      .replace(/^\s*[-*]\s+/, '')
      .replace(/\*\*|~~|_/g, '')
      .trim();
    if (line.length > 0) return line;
  }
  return '';
}

/**
 * What the board shows on the card, and what search matches against.
 *
 * Truncation happens here rather than in CSS so the same string is used for
 * the card, the page header, and the copy sheet — three places that would
 * otherwise disagree about what this patient is called.
 */
export function displayName(patient: Pick<Patient, 'name' | 'preview'>): string {
  const explicit = patient.name?.trim();
  if (explicit) return explicit;

  const derived = firstMeaningfulLine(patient.preview ?? '');
  if (!derived) return '';

  return derived.length > MAX_TITLE_LENGTH
    ? `${derived.slice(0, MAX_TITLE_LENGTH).trimEnd()}…`
    : derived;
}

/** Empty until the note has content — the board renders a placeholder. */
export function hasDisplayName(patient: Pick<Patient, 'name' | 'preview'>): boolean {
  return displayName(patient).length > 0;
}

/**
 * The board preview should start at clinical content, not at the greeting.
 *
 * Since templates carry the whole message, the first ~240 characters of a body
 * are `Assalamu'alaikum dokter…`, the identity line, and the DPJP line — which
 * made every card on the board show the same three lines of boilerplate, and
 * printed the patient's full name directly under a title that was deliberately
 * reduced to initials.
 *
 * So the preview skips leading blocks until the first heading the parser
 * recognises as clinical. Only KNOWN section ids qualify: the identity line is
 * itself a wrapped header (`*Tn. Basra / … / RM 1068190*`) and parses as a
 * custom section, so "skip the intro" alone would not have skipped it.
 */
const CLINICAL_SECTION_IDS: readonly string[] = ['s', 'o', 'ttv', 'penunjang', 'a', 'p', 'terapi'];

export function clinicalStart(sections: readonly ParsedSectionLike[]): number {
  for (const section of sections) {
    if (CLINICAL_SECTION_IDS.includes(section.sectionId)) return section.start;
  }
  // No recognised heading: a free-form note is its own preview.
  return 0;
}

export interface ParsedSectionLike {
  sectionId: string;
  start: number;
}

/**
 * Removes the patient's name from text shown on the board.
 *
 * The initials-only setting exists to keep full names off a screen that may be
 * visible to a corridor. Reducing the title while the preview underneath spells
 * the name out in full is not a partial protection — it is none.
 */
export function redactName(text: string, name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 3) return text;

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(escaped, 'gi'), '—');
}
