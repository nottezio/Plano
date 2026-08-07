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
