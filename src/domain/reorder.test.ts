import { describe, expect, it } from 'vitest';

import { moveBeside, reorderWithinVisible } from './reorder';

interface Note {
  id: string;
  shelf: 'umum' | 'jaga';
}

const ALL: Note[] = [
  { id: 'a', shelf: 'umum' },
  { id: 'x', shelf: 'jaga' },
  { id: 'b', shelf: 'umum' },
  { id: 'y', shelf: 'jaga' },
  { id: 'c', shelf: 'umum' },
];
const VISIBLE = ALL.filter((note) => note.shelf === 'umum');
const move = (from: string, to: string): string[] =>
  reorderWithinVisible(ALL, VISIBLE, (note) => note.id, from, to).map((note) => note.id);

describe('reorderWithinVisible', () => {
  it('moves an item forward within the visible order', () => {
    expect(move('a', 'c')).toEqual(['b', 'x', 'c', 'y', 'a']);
  });

  it('moves an item backward', () => {
    expect(move('c', 'a')).toEqual(['c', 'x', 'a', 'y', 'b']);
  });

  it('KEEPS every hidden item at its exact index', () => {
    // The failure this exists to prevent: rebuilding the stored array from the
    // filtered view drops everything the filter hides — silently, and with a
    // successful save as the only feedback.
    const result = reorderWithinVisible(ALL, VISIBLE, (n) => n.id, 'a', 'c');
    expect(result).toHaveLength(ALL.length);
    expect(result[1]).toMatchObject({ id: 'x' });
    expect(result[3]).toMatchObject({ id: 'y' });
  });

  it('is a no-op when the item is dropped on itself', () => {
    expect(move('b', 'b')).toEqual(['a', 'x', 'b', 'y', 'c']);
  });

  it('is a no-op when either id is not in the visible list', () => {
    expect(move('a', 'x')).toEqual(['a', 'x', 'b', 'y', 'c']);
  });
});

describe('moveBeside', () => {
  const idOf = (item: string): string => item;
  const all = ['a', 'b', 'c', 'd'];

  it('drops before the target, dragging downwards', () => {
    expect(moveBeside(all, all, idOf, 'a', 'd', 'before')).toEqual(['b', 'c', 'a', 'd']);
  });

  it('drops after the target, dragging downwards', () => {
    expect(moveBeside(all, all, idOf, 'a', 'd', 'after')).toEqual(['b', 'c', 'd', 'a']);
  });

  it('drops before and after the target, dragging upwards', () => {
    expect(moveBeside(all, all, idOf, 'd', 'a', 'before')).toEqual(['d', 'a', 'b', 'c']);
    expect(moveBeside(all, all, idOf, 'd', 'a', 'after')).toEqual(['a', 'd', 'b', 'c']);
  });

  it('is a no-op onto itself, or onto something not visible', () => {
    expect(moveBeside(all, all, idOf, 'b', 'b', 'before')).toEqual(all);
    expect(moveBeside(all, ['a', 'b'], idOf, 'a', 'd', 'after')).toEqual(all);
  });

  it('never moves what the filter hides', () => {
    // `x` and `y` are archived: they keep their exact slots in the stored list.
    const stored = ['a', 'x', 'b', 'y', 'c'];
    const shown = ['a', 'b', 'c'];
    expect(moveBeside(stored, shown, idOf, 'c', 'a', 'before')).toEqual(['c', 'x', 'a', 'y', 'b']);
  });
});
