/**
 * The document categories, in one place.
 *
 * There were two lists and they disagreed. `DEFAULT_DOCUMENT_CATEGORIES` in the
 * repository held three ids; `CATEGORY_LABELS` in `DocumentsPage` held four,
 * adding `pasien` — and it was a UI-local constant, so nothing outside that one
 * file could see the labels at all.
 *
 * That is why the category control on a document offered `lainnya` and nothing
 * else: unable to reach either list, it fell back to the categories existing
 * documents happened to use, and every seeded document is `lainnya`. It also
 * showed the raw `jadwal_poli` rather than "Jadwal poli", for the same reason.
 *
 * Ids are stored, labels are shown. They are separate because the id is written
 * into every document and renaming a label must not rewrite them — and because
 * an id like `jadwal_poli` is a key, not something to put in front of a reader.
 */
export interface DocumentCategory {
  id: string;
  label: string;
}

export const DOCUMENT_CATEGORIES: readonly DocumentCategory[] = [
  { id: 'jadwal_poli', label: 'Jadwal poli' },
  { id: 'format', label: 'Format' },
  { id: 'pasien', label: 'Terkait pasien' },
  { id: 'lainnya', label: 'Lainnya' },
];

/**
 * The label for a category id.
 *
 * Falls back to the id itself, because a user can type a category we have never
 * heard of and it has to render as what they typed rather than as blank.
 */
export function documentCategoryLabel(id: string): string {
  return DOCUMENT_CATEGORIES.find((category) => category.id === id)?.label ?? id;
}
