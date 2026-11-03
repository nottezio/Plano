import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';

import {
  activeBoardNotes,
  DEFAULT_STICKY_STYLE,
  noteIdFromCanvasId,
  STICKY_COLORS,
  STICKY_STYLES,
  stickyCanvasId,
  stickyPaper,
  stickyStyleOf,
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

describe('sticky note looks', () => {
  it('lists each look once, with the default among them', () => {
    const ids = STICKY_STYLES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_STICKY_STYLE);
    expect(ids).toContain('klasik');
  });

  it('reads a missing or unknown value as the default, so an old profile or a newer build never breaks the board', () => {
    expect(stickyStyleOf(undefined)).toBe(DEFAULT_STICKY_STYLE);
    expect(stickyStyleOf('hologram')).toBe(DEFAULT_STICKY_STYLE);
    expect(stickyStyleOf(null)).toBe(DEFAULT_STICKY_STYLE);
    expect(stickyStyleOf('bergaris')).toBe('bergaris');
  });

  it('paints the note in its own colour, but a push-pinned note on neutral paper with the colour on the pin', () => {
    expect(stickyPaper('hijau', 'postit')).toEqual({
      '--paper-bg': 'var(--paper-hijau-bg)',
      '--paper-fg': 'var(--paper-hijau-fg)',
      '--pin': 'var(--pin-hijau)',
    });
    const pinned = stickyPaper('biru', 'dipaku');
    expect(pinned['--paper-bg']).toBe('var(--paper-neutral-bg)');
    expect(pinned['--pin']).toBe('var(--pin-biru)');
  });

  it('falls back to yellow for a colour it does not know', () => {
    expect(stickyPaper('nope' as never, 'postit')['--paper-bg']).toBe('var(--paper-kuning-bg)');
  });

  it('has a paper pair (held by check:contrast) and a pin for every colour, in every theme block', () => {
    const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
    const names = [...STICKY_COLORS.map((c) => c.id), 'neutral'];
    for (const name of names) {
      // Once per theme block: light, dark, Senja.
      expect(css.match(new RegExp(`--paper-${name}-bg:`, 'g'))?.length).toBe(3);
      expect(css.match(new RegExp(`--paper-${name}-fg:`, 'g'))?.length).toBe(3);
    }
    for (const color of STICKY_COLORS) expect(css).toContain(`--pin-${color.id}:`);
  });
});
