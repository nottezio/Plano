import { describe, expect, it } from 'vitest';

import {
  addPhoneShelf,
  MAX_PHONE_SHELVES,
  mergeScope,
  putOnShelf,
  removePhoneShelf,
  renamePhoneShelf,
  sanitizePhoneShelves,
  shelfOfPatient,
  shelvedIds,
  takeOffShelf,
  togglePhoneShelf,
  type PhoneShelf,
} from './phoneShelf';

const shelf = (id: string, ids: string[], extra: Partial<PhoneShelf> = {}): PhoneShelf => ({ id, title: 'Shelf', scope: 'mine', ids, ...extra });

describe('sanitizePhoneShelves', () => {
  it('reads valid shelves and drops junk', () => {
    const read = sanitizePhoneShelves({
      shelves: [{ id: 'a', title: '  Pulang  ', scope: 'temporary', closed: true, ids: ['p1', 'p2', 3, ''] }, null, { title: 'no id' }, { id: 'b', ids: 'x' }],
    });
    expect(read).toEqual([
      { id: 'a', title: 'Pulang', scope: 'temporary', closed: true, ids: ['p1', 'p2'] },
      { id: 'b', title: 'Shelf', scope: 'mine', ids: [] },
    ]);
  });

  it('puts a patient on one shelf only, and a shelf id once', () => {
    const read = sanitizePhoneShelves({ shelves: [{ id: 'a', ids: ['p1'] }, { id: 'b', ids: ['p1', 'p2'] }, { id: 'a', ids: ['p9'] }] });
    expect(read.map((s) => s.ids)).toEqual([['p1'], ['p2']]);
  });

  it('is empty for an old grid without shelves', () => {
    expect(sanitizePhoneShelves({ cells: {}, columns: 3 })).toEqual([]);
    expect(sanitizePhoneShelves(undefined)).toEqual([]);
  });
});

describe('editing shelves', () => {
  it('adds a shelf, up to the limit per view', () => {
    let list: PhoneShelf[] = [];
    for (let n = 0; n < MAX_PHONE_SHELVES + 2; n += 1) list = addPhoneShelf(list, 'mine', 1000);
    expect(list).toHaveLength(MAX_PHONE_SHELVES);
    expect(new Set(list.map((s) => s.id)).size).toBe(MAX_PHONE_SHELVES);
    // The other view has its own allowance.
    expect(addPhoneShelf(list, 'temporary', 1000)).toHaveLength(MAX_PHONE_SHELVES + 1);
  });

  it('renames, falling back to Shelf when blank', () => {
    const list = [shelf('a', [])];
    expect(renamePhoneShelf(list, 'a', ' Berkas ')[0]!.title).toBe('Berkas');
    expect(renamePhoneShelf(list, 'a', '   ')[0]!.title).toBe('Shelf');
  });

  it('folds and unfolds', () => {
    const closed = togglePhoneShelf([shelf('a', [])], 'a');
    expect(closed[0]!.closed).toBe(true);
    expect('closed' in togglePhoneShelf(closed, 'a')[0]!).toBe(false);
  });

  it('puts a patient on a shelf at the end or at an index, and off any other shelf', () => {
    const start = [shelf('a', ['p1', 'p2']), shelf('b', ['p3'])];
    const moved = putOnShelf(start, 'p1', 'b');
    expect(moved.map((s) => s.ids)).toEqual([['p2'], ['p3', 'p1']]);
    expect(putOnShelf(moved, 'p1', 'b', 0)[1]!.ids).toEqual(['p1', 'p3']);
    expect(shelfOfPatient(moved, 'p1')).toBe('b');
    expect(shelfOfPatient(moved, 'zz')).toBeNull();
  });

  it('ignores a drop on a shelf that is gone', () => {
    expect(putOnShelf([shelf('a', ['p1'])], 'p1', 'nope')).toEqual([shelf('a', ['p1'])]);
  });

  it('takes a patient off, and removing a shelf frees its patients', () => {
    const list = [shelf('a', ['p1', 'p2'])];
    expect(takeOffShelf(list, 'p1')[0]!.ids).toEqual(['p2']);
    const removed = removePhoneShelf(list, 'a');
    expect(removed).toEqual([]);
    expect(shelvedIds(removed).size).toBe(0);
  });

  it('merging one view keeps the other view as it was', () => {
    const all = [shelf('m1', ['p1']), shelf('t1', ['q1'], { scope: 'temporary' })];
    const merged = mergeScope(all, 'mine', [shelf('m1', ['p1', 'p2']), shelf('m2', [])]);
    expect(merged.map((s) => [s.id, s.scope])).toEqual([
      ['t1', 'temporary'],
      ['m1', 'mine'],
      ['m2', 'mine'],
    ]);
    expect(merged.find((s) => s.id === 't1')!.ids).toEqual(['q1']);
  });
});
