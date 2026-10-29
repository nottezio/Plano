import { describe, expect, it } from 'vitest';

import type { CanvasLayouts } from './canvasLayout';
import { applyRemoteShelves, canvasShelfId, layoutsWithShelves, shelfKey, shelfPatch, shelvesFromLayouts } from './shelfSync';

const card = (x: number, y: number, extra: Record<string, unknown> = {}) => ({ x, y, w: 0.24, hMax: 0, ...extra });
const rak = (y: number, extra: Record<string, unknown> = {}) => ({ x: 0, y, w: 0.25, hMax: 0, title: 'Shelf', ...extra });

const laptop: CanvasLayouts = {
  p1: card(0.1, 100),
  p2: card(0.4, 100, { shelf: 'rak:a', shelfAt: 20 }),
  p3: card(0.7, 100, { shelf: 'rak:a', shelfAt: 10 }),
  'rak:a': rak(600, { title: 'Pulang', closed: true }),
  'rak:b': rak(900, { scope: 'temporary' }),
};

describe('shelvesFromLayouts', () => {
  it('reads titles, folds, views and cards in the order they were put on', () => {
    expect(shelvesFromLayouts(laptop)).toEqual([
      { id: 'rak:a', title: 'Pulang', scope: 'mine', closed: true, ids: ['p3', 'p2'] },
      { id: 'rak:b', title: 'Shelf', scope: 'temporary', ids: [] },
    ]);
  });

  it('ignores a card whose shelf no longer exists', () => {
    expect(shelvesFromLayouts({ p1: card(0, 0, { shelf: 'rak:gone', shelfAt: 1 }) })).toEqual([]);
  });
});

describe('layoutsWithShelves', () => {
  it('puts a patient on a shelf at the end, without moving anything else', () => {
    const edited = shelvesFromLayouts(laptop).map((s) => (s.id === 'rak:a' ? { ...s, ids: [...s.ids, 'p1'] } : s));
    const next = layoutsWithShelves(laptop, edited, 1000);
    expect(next.p1).toMatchObject({ x: 0.1, y: 100, shelf: 'rak:a', shelfAt: 1000 });
    expect(shelfPatch(laptop, next)).toEqual({ p1: next.p1 });
  });

  it('gives a patient with no layout one, and lists it on the shelf', () => {
    const edited = shelvesFromLayouts(laptop).map((s) => (s.id === 'rak:b' ? { ...s, ids: ['p9'] } : s));
    const next = layoutsWithShelves(laptop, edited, 1000);
    expect(shelvesFromLayouts(next).find((s) => s.id === 'rak:b')!.ids).toEqual(['p9']);
  });

  it('takes a patient off a shelf, back under it, and keeps the shelf', () => {
    const edited = shelvesFromLayouts(laptop).map((s) => (s.id === 'rak:a' ? { ...s, ids: ['p3'] } : s));
    const next = layoutsWithShelves(laptop, edited);
    expect(next.p2!.shelf).toBeUndefined();
    expect(next.p2!.y).toBeGreaterThan(laptop['rak:a']!.y);
    expect(next['rak:a']).toEqual(laptop['rak:a']);
    expect(Object.keys(shelfPatch(laptop, next))).toEqual(['p2']);
  });

  it('adds a shelf under everything, renames and folds', () => {
    const edited = [
      ...shelvesFromLayouts(laptop).map((s) => (s.id === 'rak:a' ? { ...s, title: '  Berkas ' } : s)),
      { id: 'rak:new', title: 'Baru', scope: 'mine' as const, closed: true as const, ids: [] },
    ];
    const next = layoutsWithShelves(laptop, edited);
    expect(next['rak:a']).toMatchObject({ title: 'Berkas', closed: true, x: 0, y: 600 });
    expect(next['rak:new']!.y).toBeGreaterThan(900);
    expect(next['rak:new']).toMatchObject({ title: 'Baru', closed: true });
  });

  it('removes a shelf and puts its patients back on the canvas', () => {
    const edited = shelvesFromLayouts(laptop).filter((s) => s.id !== 'rak:a');
    const next = layoutsWithShelves(laptop, edited);
    expect(next['rak:a']).toBeUndefined();
    expect(next.p2!.shelf).toBeUndefined();
    expect(next.p3!.shelf).toBeUndefined();
    expect(shelfPatch(laptop, next)['rak:a']).toBeNull();
  });

  it('keeps a patient on one shelf when listed on two, and moves it between shelves', () => {
    const edited = shelvesFromLayouts(laptop).map((s) =>
      s.id === 'rak:a' ? { ...s, ids: s.ids.filter((id) => id !== 'p2') } : s.id === 'rak:b' ? { ...s, ids: ['p2'] } : s,
    );
    const next = layoutsWithShelves(laptop, edited, 5000);
    expect(next.p2).toMatchObject({ shelf: 'rak:b', shelfAt: 5000 });
  });

  it('does nothing for an unchanged list', () => {
    expect(shelfPatch(laptop, layoutsWithShelves(laptop, shelvesFromLayouts(laptop)))).toEqual({});
  });

  it('starts a canvas from nothing', () => {
    const next = layoutsWithShelves({}, [{ id: 'rak:n', title: 'Shelf', scope: 'mine', ids: ['p1'] }], 7);
    expect(shelvesFromLayouts(next)).toEqual([{ id: 'rak:n', title: 'Shelf', scope: 'mine', ids: ['p1'] }]);
  });
});

describe('canvasShelfId', () => {
  it('turns the old phone ids into canvas ids, and leaves canvas ids alone', () => {
    expect(canvasShelfId('ps:abc')).toBe('rak:abc');
    expect(canvasShelfId('rak:abc')).toBe('rak:abc');
  });
});

describe('applyRemoteShelves', () => {
  it('is the same object when the shelves already agree, whatever the positions', () => {
    const moved = { ...laptop, p1: card(0.9, 9999) };
    expect(applyRemoteShelves(laptop, moved)).toBe(laptop);
  });

  it('takes the phone\'s shelving, folds and renames, and keeps its own positions', () => {
    const remote = layoutsWithShelves(
      { ...laptop, p1: card(0.5, 5) },
      shelvesFromLayouts(laptop).map((s) => (s.id === 'rak:a' ? { id: s.id, scope: s.scope, title: 'Selesai', ids: [...s.ids, 'p1'] } : s)),
      3000,
    );
    const next = applyRemoteShelves(laptop, remote);
    expect(shelvesFromLayouts(next)[0]).toMatchObject({ id: 'rak:a', title: 'Selesai', ids: ['p3', 'p2', 'p1'] });
    expect(next['rak:a']).toMatchObject({ x: 0, y: 600 });
    expect(next.p1).toMatchObject({ x: 0.1, y: 100, shelf: 'rak:a', shelfAt: 3000 });
    expect(shelfKey(next)).toBe(shelfKey(remote));
  });

  it('brings a card back where the phone put it, and drops a removed shelf', () => {
    const remote = layoutsWithShelves(laptop, shelvesFromLayouts(laptop).filter((s) => s.id !== 'rak:a'));
    const next = applyRemoteShelves(laptop, remote);
    expect(next['rak:a']).toBeUndefined();
    expect(next.p2).toMatchObject({ x: remote.p2!.x, y: remote.p2!.y });
    expect(next.p2!.shelf).toBeUndefined();
  });

  it('adds a shelf the phone made, and a layout for a patient only the phone knew', () => {
    const remote = layoutsWithShelves(laptop, [...shelvesFromLayouts(laptop), { id: 'rak:n', title: 'Baru', scope: 'mine', ids: ['p9'] }], 8);
    const next = applyRemoteShelves(laptop, remote);
    expect(shelvesFromLayouts(next).find((s) => s.id === 'rak:n')!.ids).toEqual(['p9']);
  });
});
