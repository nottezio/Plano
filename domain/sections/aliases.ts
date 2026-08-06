import { DEFAULT_SECTION_ALIASES } from '../defaults';
import type { SectionAlias, SectionId } from '../types';

/**
 * SPEC 12.1 — the alias table drives the parser.
 *
 * It is *configuration*, not schema. Editing an alias re-parses every body on
 * the fly; no migration is possible and none is needed, because the parse is
 * derived and the stored text never changes. That is the whole point of the
 * redesign: structure is detected, never enforced.
 */

export { DEFAULT_SECTION_ALIASES };

export function aliasesOrDefault(
  aliases: readonly SectionAlias[] | undefined,
): readonly SectionAlias[] {
  return aliases && aliases.length > 0 ? aliases : DEFAULT_SECTION_ALIASES;
}

/** Output order when composing a subset (SPEC 12.4). */
export function sortedAliases(aliases: readonly SectionAlias[]): SectionAlias[] {
  return [...aliases].sort((a, b) => a.order - b.order);
}

export function labelFor(
  sectionId: SectionId,
  aliases: readonly SectionAlias[],
): string {
  if (sectionId === '_intro') return 'Catatan';
  const known = aliases.find((alias) => alias.sectionId === sectionId);
  if (known) return known.label;
  if (sectionId.startsWith('custom_')) return unslug(sectionId.slice('custom_'.length));
  return sectionId;
}

/**
 * Composition order for a mixed set of known and custom sections.
 *
 * Custom sections sort after every configured one, in first-appearance order,
 * because the user never assigned them a position — inventing one would
 * reorder their note against their intent.
 */
export function sectionSortIndex(
  sectionId: SectionId,
  aliases: readonly SectionAlias[],
): number {
  if (sectionId === '_intro') return -1;
  const known = aliases.find((alias) => alias.sectionId === sectionId);
  return known ? known.order : Number.MAX_SAFE_INTEGER;
}

/** "Pemeriksaan Penunjang" → "pemeriksaan_penunjang" */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function unslug(slug: string): string {
  return slug
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function customSectionId(token: string): SectionId {
  return `custom_${slugify(token)}` as SectionId;
}

/**
 * Guards user-entered aliases in Settings.
 *
 * An empty or whitespace-only alias would compile into a regex that matches
 * every line, turning the whole note into headers. A duplicate across two
 * sections would make detection order-dependent and therefore unstable.
 */
export interface AliasValidation {
  ok: boolean;
  errors: string[];
}

export function validateAliases(aliases: readonly SectionAlias[]): AliasValidation {
  const errors: string[] = [];
  const seen = new Map<string, SectionId>();

  for (const alias of aliases) {
    if (!alias.label.trim()) errors.push(`Label kosong untuk "${alias.sectionId}".`);
    if (alias.aliases.length === 0) {
      errors.push(`"${alias.label}" tidak punya kata kunci.`);
    }
    for (const token of alias.aliases) {
      const normalized = token.trim().toLowerCase();
      if (!normalized) {
        errors.push(`"${alias.label}" punya kata kunci kosong.`);
        continue;
      }
      const owner = seen.get(normalized);
      if (owner && owner !== alias.sectionId) {
        errors.push(`Kata kunci "${token}" dipakai oleh dua bagian.`);
      }
      seen.set(normalized, alias.sectionId);
    }
  }

  return { ok: errors.length === 0, errors };
}
