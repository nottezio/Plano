import { describe, expect, it } from 'vitest';

import { DEFAULT_DOCUMENT_CATEGORIES } from '@/data/repositories/documents.repo';
import { DOCUMENT_CATEGORIES, documentCategoryLabel } from './documentCategories';
import { SEED_DOCUMENTS } from './seedDocuments';

describe('document categories', () => {
  it('includes every category the app offers', () => {
    expect(DOCUMENT_CATEGORIES.map((category) => category.id)).toEqual([
      'jadwal_poli',
      'format',
      'pasien',
      'lainnya',
    ]);
  });

  it('is the only list — the repository derives from it', () => {
    /*
     * There were two hand-written lists and they disagreed: the repository's
     * was missing `pasien`, and nothing caught it because the other lived
     * inside a route file where only that file could reach it.
     */
    expect([...DEFAULT_DOCUMENT_CATEGORIES]).toEqual(
      DOCUMENT_CATEGORIES.map((category) => category.id),
    );
  });

  it('shows a label, never a raw id', () => {
    expect(documentCategoryLabel('jadwal_poli')).toBe('Jadwal poli');
    expect(documentCategoryLabel('pasien')).toBe('Terkait pasien');
  });

  it('falls back to the id for a category the user invented', () => {
    // It has to render as what they typed rather than as blank.
    expect(documentCategoryLabel('protokol saya')).toBe('protokol saya');
  });

  it('every seeded document uses a category that exists', () => {
    const known = new Set(DOCUMENT_CATEGORIES.map((category) => category.id));
    for (const seed of SEED_DOCUMENTS) expect(known.has(seed.category)).toBe(true);
  });
});
