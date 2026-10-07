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
    expect(result[0]?.note).toEqual({ text: '', color: 'kuning', createdAt: 0, images: [] });
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

describe('images on a note', () => {
  it('keeps only string ids', () => {
    const notes = {
      n: { text: '', color: 'kuning', createdAt: 1, images: ['a', 3, null, 'b'] },
    } as unknown as BoardNotes;
    expect(activeBoardNotes(notes)[0]?.note.images).toEqual(['a', 'b']);
  });
});

describe('notes per board (Pasien saya / Titipan)', () => {
  const notes = {
    old: { text: 'lab jam 14', color: 'kuning' as const, createdAt: 1 },
    titip: { text: 'titipan: cek TTV', color: 'biru' as const, createdAt: 2, scope: 'temporary' as const },
  };

  it('a note written before scopes existed stays on Pasien saya', () => {
    expect(activeBoardNotes(notes, 'mine').map((entry) => entry.id)).toEqual(['old']);
  });

  it('a Titipan note is shown only on Titipan', () => {
    expect(activeBoardNotes(notes, 'temporary').map((entry) => entry.id)).toEqual(['titip']);
    expect(activeBoardNotes(notes, 'temporary')[0]?.note.scope).toBe('temporary');
  });

  it('without a scope, every note (as before)', () => {
    expect(activeBoardNotes(notes)).toHaveLength(2);
  });
});
