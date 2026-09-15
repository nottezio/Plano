import { describe, expect, it } from 'vitest';

import { applyPending, settlePending } from './pendingBodies';

const NOTES = [
  { id: 'a', body: 'catatan A' },
  { id: 'b', body: 'catatan B' },
];

describe('applyPending', () => {
  it('replays a write the server has not echoed yet', () => {
    // The reported failure: switching tabs saved note B from a snapshot taken
    // before note A's save came back, overwriting A's checklist with its old
    // body.
    const pending = new Map([['a', 'catatan A + checklist']]);
    expect(applyPending(NOTES, pending)).toEqual([
      { id: 'a', body: 'catatan A + checklist' },
      { id: 'b', body: 'catatan B' },
    ]);
  });

  it('leaves the array alone when nothing is pending', () => {
    expect(applyPending(NOTES, new Map())).toEqual(NOTES);
  });

  it('ignores a pending id that is no longer in the list', () => {
    // A note deleted while its save was in flight must not be resurrected.
    expect(applyPending(NOTES, new Map([['gone', 'x']]))).toEqual(NOTES);
  });

  it('does not clone a note whose pending value already matches', () => {
    const result = applyPending(NOTES, new Map([['a', 'catatan A']]));
    expect(result[0]).toBe(NOTES[0]);
  });
});

describe('settlePending', () => {
  it('drops an entry once the server says the same thing back', () => {
    const pending = new Map([['a', 'catatan A']]);
    settlePending(NOTES, pending);
    expect(pending.size).toBe(0);
  });

  it('KEEPS an entry the server has not confirmed', () => {
    const pending = new Map([['a', 'belum sampai']]);
    settlePending(NOTES, pending);
    expect(pending.get('a')).toBe('belum sampai');
  });

  it('compares by value, not by the write having resolved', () => {
    // A resolved promise says the request was accepted, not that this is what
    // the document holds — another device may have written in between, and
    // then the pending value is stale and must stop being replayed.
    const pending = new Map([['b', 'catatan B']]);
    settlePending([{ id: 'b', body: 'ditulis perangkat lain' }], pending);
    expect(pending.get('b')).toBe('catatan B');
  });
});
