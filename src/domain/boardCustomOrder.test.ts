import { describe, expect, it } from 'vitest';

import { buildCard, orderPatients, reorderBoard } from './board';
import { makePatient } from './testFactories';

const A = makePatient({ id: 'a', name: 'A' });
const B = makePatient({ id: 'b', name: 'B' });
const C = makePatient({ id: 'c', name: 'C' });

describe('custom board order', () => {
  it('follows the stored order', () => {
    const out = orderPatients([A, B, C], 'custom', ['c', 'a', 'b']);
    expect(out.map((patient) => patient.id)).toEqual(['c', 'a', 'b']);
  });

  it('puts a patient missing from the order FIRST, not last', () => {
    // A patient admitted after the last reorder has no place in the list.
    // Filing them at the bottom of a long board hides a new admission, which
    // is the one failure a ward list must not have — at the top it is
    // noticeable and easily corrected.
    const out = orderPatients([A, B, C], 'custom', ['c', 'a']);
    expect(out.map((patient) => patient.id)[0]).toBe('b');
  });

  it('keeps pinned patients above the hand-made order', () => {
    // Pinning means "this one first" in every other mode; one mode where it
    // stopped meaning that would make it untrustworthy in all of them.
    const pinned = makePatient({ id: 'p', name: 'P', pinned: true });
    const out = orderPatients([A, pinned, B], 'custom', ['b', 'a', 'p']);
    expect(out.map((patient) => patient.id)[0]).toBe('p');
  });

  it('ignores ids for patients no longer on the board', () => {
    const out = orderPatients([A, B], 'custom', ['b', 'gone', 'a']);
    expect(out.map((patient) => patient.id)).toEqual(['b', 'a']);
  });
});

describe('reorderBoard', () => {
  it('moves a card to the target position', () => {
    expect(reorderBoard([A, B, C], 'c', 'a')).toEqual(['c', 'a', 'b']);
    expect(reorderBoard([A, B, C], 'a', 'c')).toEqual(['b', 'c', 'a']);
  });

  it('returns a complete order, not a patch', () => {
    // The stored list is replaced outright, so it has to include every id
    // currently on the board.
    expect(reorderBoard([A, B, C], 'b', 'a')).toHaveLength(3);
  });

  it('treats a drop on itself as no move', () => {
    expect(reorderBoard([A, B, C], 'b', 'b')).toEqual(['a', 'b', 'c']);
  });

  it('ignores a card that is no longer on the board', () => {
    expect(reorderBoard([A, B, C], 'gone', 'a')).toEqual(['a', 'b', 'c']);
  });
});

describe('pemantauan', () => {
  it('reaches the card as a boolean', () => {
    const watched = makePatient({ id: 'w', name: 'W', pemantauan: true });
    expect(buildCard(watched, [], '2026-09-04', false).pemantauan).toBe(true);
  });

  it('is false when the field has never been set', () => {
    // Optional on the type, so every patient written before it existed lacks
    // it — absence must read as "not watched", not as undefined leaking into
    // the card.
    const plain = makePatient({ id: 'p', name: 'P' });
    expect(buildCard(plain, [], '2026-09-04', false).pemantauan).toBe(false);
  });

  it('does not change where the card sits', () => {
    // `pinned` decides position; this decides nothing but the marker.
    const watched = makePatient({ id: 'w', name: 'W', pemantauan: true });
    const plain = makePatient({ id: 'p', name: 'P' });
    expect(orderPatients([plain, watched], 'recent').map((x) => x.id)).toEqual(['p', 'w']);
  });
});
