import { describe, expect, it } from 'vitest';

import { reorderWithinVisible } from './reorder';

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
