import { describe, expect, it } from 'vitest';

import {
  addShelf,
  placeAll,
  removeShelf,
  sanitizeLayouts,
  shelfAtFor,
  shelfContents,
  shelfOf,
  shelve,
  shelvesOf,
  tidy,
  unshelve,
  type CanvasLayouts,
} from './canvasLayout';

const card = (x: number, y: number) => ({ x, y, w: 0.25, hMax: 0 });

describe('shelves on the canvas (2026-10-16)', () => {
  it('a new shelf goes under everything, named "Shelf", in its board view', () => {
    const { id, layout } = addShelf(4, 800, 'mine', 1000);
    expect(id).toBe('rak:rs');
    expect(layout).toEqual({ x: 0, y: 812, w: 0.25, hMax: 0, title: 'Shelf' });
    expect(addShelf(4, 0, 'temporary', 1000).layout.scope).toBe('temporary');
  });

  it('Pasien saya and Titipan each have their own shelves (2026-10-17)', () => {
    const layouts: CanvasLayouts = {
      'rak:a': { ...card(0, 0), title: 'Shelf' },
      'rak:b': { ...card(0, 0), title: 'Shelf', scope: 'temporary' },
    };
    expect(shelvesOf(layouts)).toEqual(['rak:a']);
    expect(shelvesOf(layouts, 'mine')).toEqual(['rak:a']);
    expect(shelvesOf(layouts, 'temporary')).toEqual(['rak:b']);
  });

  it('a card dropped among the shelf cards takes its place there (2026-10-17)', () => {
    const layouts: CanvasLayouts = {
      'rak:a': { ...card(0, 400), title: 'Shelf' },
      p1: shelve(card(0, 0), 'rak:a', 10),
      p2: shelve(card(0, 0), 'rak:a', 20),
      p3: shelve(card(0, 0), 'rak:a', 30),
    };
    const ids = ['p1', 'p2', 'p3'];
    const placed = (index: number): string[] => {
      const next = { ...layouts, p3: shelve(layouts.p3!, 'rak:a', shelfAtFor(layouts, ['p1', 'p2'], index, 99)) };
      return shelfContents(next, 'rak:a', ids);
    };
    expect(placed(0)).toEqual(['p3', 'p1', 'p2']);
    expect(placed(1)).toEqual(['p1', 'p3', 'p2']);
    expect(placed(2)).toEqual(['p1', 'p2', 'p3']);
    expect(shelfAtFor(layouts, [], 0, 99)).toBe(99);
  });

  it('cards on a shelf are listed in the order they were put there; a removed shelf frees them', () => {
    const layouts: CanvasLayouts = {
      'rak:a': { ...card(0, 500), title: 'Menunggu berkas' },
      p1: shelve(card(0, 0), 'rak:a', 20),
      p2: shelve(card(0.25, 0), 'rak:a', 10),
      p3: card(0.5, 0),
      p4: shelve(card(0.75, 0), 'rak:gone', 5),
    };
    expect(shelvesOf(layouts)).toEqual(['rak:a']);
    expect(shelfContents(layouts, 'rak:a', ['p1', 'p2', 'p3', 'p4'])).toEqual(['p2', 'p1']);
    // A card whose shelf no longer exists is back on the canvas.
    expect(shelfOf(layouts, 'p4')).toBeNull();
    const freed = removeShelf(layouts, 'rak:a', ['p1', 'p2', 'p3'], 140);
    expect(freed['rak:a']).toBeUndefined();
    expect(freed.p2).toEqual(card(0, 652));
    expect(freed.p1).toEqual(card(0, 912));
  });

  it('off the shelf: where it was dropped, the shelf fields gone', () => {
    expect(unshelve(shelve(card(0.1, 10), 'rak:a', 1), { x: 0.5, y: 300 })).toEqual(card(0.5, 300));
  });

  it('keeps shelf fields through storage, and nothing it should not', () => {
    const clean = sanitizeLayouts({
      'rak:a': { x: 0, y: 10, w: 0.3, hMax: 0, title: 'x'.repeat(60), closed: true },
      'rak:b': { x: 0, y: 10, w: 0.3, hMax: 0, title: 'Rak', scope: 'temporary' },
      p1: { x: 0, y: 0, w: 0.25, hMax: 0, shelf: 'rak:a', shelfAt: 7 },
      p2: { x: 0, y: 0, w: 0.25, hMax: 0, shelf: 'not-a-shelf' },
    });
    expect(clean['rak:a']).toEqual({ x: 0, y: 10, w: 0.3, hMax: 0, title: 'x'.repeat(40), closed: true });
    // The old default name reads as the new one; the view is kept.
    expect(clean['rak:b']).toEqual({ x: 0, y: 10, w: 0.3, hMax: 0, title: 'Shelf', scope: 'temporary' });
    expect(clean.p1).toEqual({ x: 0, y: 0, w: 0.25, hMax: 0, shelf: 'rak:a', shelfAt: 7 });
    expect(clean.p2).toEqual({ x: 0, y: 0, w: 0.25, hMax: 0 });
  });

  it('a tall shelf keeps new cards and tidied rows clear of it', () => {
    const stored: CanvasLayouts = { 'rak:a': { ...card(0, 0), title: 'Shelf' } };
    // Without the height a new card would go at y 260, inside a 600-tall shelf.
    const placed = placeAll(['rak:a', 'n1', 'n2', 'n3', 'n4'], stored, 4, { 'rak:a': 600 });
    expect([placed.n1!.x, placed.n3!.x]).toEqual([0.25, 0.75]);
    // Row 2, column 1 is still the shelf: the next slot along.
    expect([placed.n4!.x, placed.n4!.y]).toEqual([0.25, 260]);
    const tidied = tidy(['rak:a', 'c1', 'c2', 'c3', 'c4'], { 'rak:a': stored['rak:a']!, c1: card(0.25, 0), c2: card(0.5, 0), c3: card(0.75, 0), c4: card(0, 900) }, 4, { 'rak:a': 600 });
    expect(tidied.c4!.y).toBe(612);
  });
});
