import type { AppDocument } from './types';

/**
 * Categories are free text, exactly like a document's title.
 *
 * This file used to define a fixed set of four ids with labels — `jadwal_poli`,
 * `format`, `pasien`, `lainnya` — and treated them as an enum the app
 * understood specially. Nothing reads `category === 'jadwal_poli'` to change
 * behaviour anywhere; a category is a label the user writes on a document to
 * group it with others. The filter tabs on the Dokumen list ("Semua" /
 * "Lainnya" / "Terkait pasien") are already just whatever strings the user's
 * documents currently carry, sorted — there was never a fixed list backing
 * them, only this file pretending there was.
 *
 * Treating them as an enum actively worked against the thing being asked for:
 * renaming "Lainnya" to something meaningful, or deleting an empty tab, is an
 * edit to text the user wrote, not a choice from a list the app ships.
 */

/**
 * The categories present across a set of documents, sorted.
 *
 * Mirrors what `DocumentsPage` already computed inline for its filter tabs —
 * pulled out here so the category-management sheet and the tab row read the
 * same set rather than deriving it twice and risking the two disagreeing,
 * which is exactly the failure that happened when the fixed list and the
 * route-local label map fell out of step with each other.
 */
export function documentCategories(
  documents: readonly Pick<AppDocument, 'category'>[],
): string[] {
  return [...new Set(documents.map((doc) => doc.category).filter(Boolean))].sort();
}

/**
 * Which documents a category rename or deletion touches.
 *
 * Exact string match, case-sensitive. A category is whatever the user typed,
 * and quietly folding "Format" and "format" together would surprise someone
 * who deliberately kept them apart — the same reasoning `mergeStringList`
 * elsewhere in this codebase uses for value-based matching: act on exactly
 * what is there, not on a guessed equivalence.
 */
export function documentsInCategory(
  documents: readonly AppDocument[],
  category: string,
): AppDocument[] {
  return documents.filter((doc) => doc.category === category);
}
