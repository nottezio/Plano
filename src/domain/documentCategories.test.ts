import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';

import { documentCategories, documentsInCategory } from './documentCategories';
import type { AppDocument } from './types';

const NOW = Timestamp.now();

function doc(id: string, category: string): AppDocument {
  return {
    id,
    title: id,
    category,
    body: '',
    pinned: false,
    order: 0,
    labels: [],
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  };
}

describe('documentCategories', () => {
  it('lists each category once, sorted', () => {
    const docs = [doc('a', 'Format'), doc('b', 'Lainnya'), doc('c', 'Format')];
    expect(documentCategories(docs)).toEqual(['Format', 'Lainnya']);
  });

  it('is empty when there are no documents', () => {
    expect(documentCategories([])).toEqual([]);
  });

  it('drops an empty-string category rather than showing a blank tab', () => {
    const docs = [doc('a', ''), doc('b', 'Lainnya')];
    expect(documentCategories(docs)).toEqual(['Lainnya']);
  });
});

describe('documentsInCategory', () => {
  it('matches exactly, case-sensitively', () => {
    /*
     * A category is whatever the user typed. Folding "Format" and "format"
     * together would surprise someone who deliberately kept them apart — the
     * same reasoning `mergeStringList` uses elsewhere for value-based
     * matching: act on exactly what is there, not a guessed equivalence.
     */
    const docs = [doc('a', 'Format'), doc('b', 'format')];
    expect(documentsInCategory(docs, 'Format').map((d) => d.id)).toEqual(['a']);
  });

  it('returns nothing for a category no document has', () => {
    expect(documentsInCategory([doc('a', 'Format')], 'Lainnya')).toEqual([]);
  });
});
