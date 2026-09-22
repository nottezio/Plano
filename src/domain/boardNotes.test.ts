import { describe, expect, it } from 'vitest';

import {
  activeBoardNotes,
  noteIdFromCanvasId,
  stickyCanvasId,
  stickyTone,
  type BoardNotes,
} from './boardNotes';

describe('activeBoardNotes', () => {
  it('drops soft-deleted notes and orders the rest oldest first', () => {
    const notes: BoardNotes = {
      b: { text: 'kedua', color: 'biru', createdAt: 200 },
      a: { text: 'pertama', color: 'kuning', createdAt: 100 },
      gone: { text: 'dihapus', color: 'hijau', createdAt: 50, deletedAt: 300 },
    };
    expect(activeBoardNotes(notes).map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('survives a malformed entry instead of taking the board down', () => {
    const notes = {
      ok: { text: 'baik', color: 'kuning', createdAt: 1 },
      broken: { color: 'bukan-warna' },
      nothing: null,
    } as unknown as BoardNotes;
    const result = activeBoardNotes(notes);
    expect(result.map((entry) => entry.id)).toEqual(['broken', 'ok']);
    expect(result[0]?.note).toEqual({ text: '', color: 'kuning', createdAt: 0 });
  });

  it('is empty when there is no map at all', () => {
    expect(activeBoardNotes(undefined)).toEqual([]);
  });
});

describe('canvas ids', () => {
  it('round-trips a note id', () => {
    expect(noteIdFromCanvasId(stickyCanvasId('n1'))).toBe('n1');
  });

  it('never reads a patient id as a note', () => {
    expect(noteIdFromCanvasId('pAbc123')).toBeNull();
  });
});

describe('stickyTone', () => {
  it('uses theme tokens, yellow by default', () => {
    expect(stickyTone('kuning').bg).toBe('var(--card-step-3-bg)');
    expect(stickyTone('ungu' as never).fg).toMatch(/^var\(--card-step-\d+-fg\)$/);
  });
});
