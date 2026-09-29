import { describe, expect, it } from 'vitest';

import {
  checklistProgress,
  displayTitle,
  notePlainText,
  notesForView,
  noteTone,
  orderAtTop,
  orderForMove,
  previewText,
  relativeTime,
  resolveNotes,
  searchNotes,
  type NoteRecord,
  type ResolvedNote,
} from './scratchNotes';

const rec = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  title: '',
  body: '',
  order: 0,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

const resolved = (id: string, over: Partial<ResolvedNote> = {}): ResolvedNote => ({
  id,
  title: id,
  body: '',
  category: 'umum',
  order: 0,
  createdAt: 1,
  updatedAt: 1,
  legacy: false,
  ...over,
});

describe('resolveNotes', () => {
  it('reads the map and sorts pinned first, then by order', () => {
    const notes = resolveNotes({
      notesById: {
        a: rec({ title: 'A', order: 2 }),
        b: rec({ title: 'B', order: 1 }),
        c: rec({ title: 'C', order: 5, pinned: true }),
      },
    });
    expect(notes.map((n) => n.id)).toEqual(['c', 'b', 'a']);
    expect(notes.every((n) => !n.legacy)).toBe(true);
  });

  it('falls back to the legacy array for ids the map lacks, keeping array order', () => {
    const notes = resolveNotes({
      notesById: { x: rec({ title: 'baru', order: -1 }) },
      notes: [
        { id: 'x', title: 'lama x', body: 'lama' },
        { id: 'y', title: 'Y', body: '' },
        { id: 'z', title: 'Z', body: '', category: 'jaga', archived: true },
      ],
    });
    expect(notes.map((n) => [n.id, n.legacy])).toEqual([
      ['x', false],
      ['y', true],
      ['z', true],
    ]);
    // The map wins over the array for the same id.
    expect(notes[0]?.title).toBe('baru');
    expect(notes[2]).toMatchObject({ category: 'jaga', archived: true });
  });

  it('migrates the pre-tabs single note only when nothing else exists', () => {
    expect(resolveNotes({ scratchNote: 'halo' })).toMatchObject([
      { id: 'n1', title: 'Catatan', body: 'halo', legacy: true },
    ]);
    expect(resolveNotes({ scratchNote: '   ' })).toEqual([]);
    expect(resolveNotes({ scratchNote: 'halo', notes: [{ id: 'q', title: 'Q', body: '' }] }))
      .toHaveLength(1);
  });

  it('survives malformed map entries', () => {
    const notes = resolveNotes({
      notesById: { a: null, b: 'x', c: { body: 5, order: 'bad' } } as unknown,
    });
    expect(notes).toMatchObject([{ id: 'c', title: '', body: '', order: 0, category: 'umum' }]);
  });

  it('hides a purged note and keeps its legacy copy from resurfacing', () => {
    const notes = resolveNotes({
      notesById: { y: { purgedAt: 5 } } as unknown,
      notes: [{ id: 'y', title: 'dulu dihapus', body: 'x' }],
    });
    expect(notes).toEqual([]);
  });
});

describe('notesForView', () => {
  const all = [
    resolved('a'),
    resolved('b', { archived: true }),
    resolved('c', { category: 'jaga' }),
    resolved('d', { deletedAt: 10 }),
    resolved('e', { deletedAt: 20, category: 'jaga' }),
  ];

  it('aktif: this shelf, not archived, not deleted', () => {
    expect(notesForView(all, 'umum', 'aktif').map((n) => n.id)).toEqual(['a']);
    expect(notesForView(all, 'jaga', 'aktif').map((n) => n.id)).toEqual(['c']);
  });

  it('arsip: this shelf, archived only', () => {
    expect(notesForView(all, 'umum', 'arsip').map((n) => n.id)).toEqual(['b']);
  });

  it('sampah spans both shelves, newest deletion first', () => {
    expect(notesForView(all, 'umum', 'sampah').map((n) => n.id)).toEqual(['e', 'd']);
  });
});

describe('searchNotes', () => {
  const all = [
    resolved('a', { title: 'Jaga Sabtu', body: '<p>Pak B: EKG ulang jam 14</p>' }),
    resolved('b', { title: 'Obat', body: '<p>furosemid</p>', archived: true }),
    resolved('c', { title: 'EKG', body: '', deletedAt: 1 }),
    resolved('d', { title: 'Referensi EKG', body: '' }),
  ];

  it('matches every word in any order, case-insensitive', () => {
    expect(searchNotes(all, 'ekg pak').map((n) => n.id)).toEqual(['a']);
  });

  it('never searches the trash and puts archived after active', () => {
    expect(searchNotes(all, 'ekg').map((n) => n.id)).toEqual(['a', 'd']);
    expect(searchNotes(all, 'furosemid').map((n) => n.id)).toEqual(['b']);
  });

  it('an empty query is no search', () => {
    expect(searchNotes(all, '   ')).toEqual([]);
  });
});

describe('notePlainText', () => {
  it('keeps block structure as lines', () => {
    expect(notePlainText('<p>Baris satu</p><p>Baris dua</p>')).toBe('Baris satu\nBaris dua');
    expect(notePlainText('<ul><li>EKG</li><li>Lab</li></ul>')).toBe('• EKG\n• Lab');
  });

  it('decodes entities and drops tags and attributes', () => {
    expect(notePlainText('<b>TD</b> 120/80 &amp; nadi&nbsp;80')).toBe('TD 120/80 & nadi 80');
    expect(notePlainText('<div onclick="x()">halo</div><img src="y">')).toBe('halo');
  });

  it('collapses runs of blank lines and treats an empty paragraph as empty', () => {
    expect(notePlainText('<p>a</p><br><br><br><p>b</p>')).toBe('a\n\nb');
    expect(notePlainText('<p><br></p>')).toBe('');
  });

  it('shows checklist state in both markups', () => {
    expect(
      notePlainText('<ul class="cl"><li data-checked="true">EKG</li><li data-checked="false">Lab</li></ul>'),
    ).toBe('☑ EKG\n☐ Lab');
    expect(
      notePlainText(
        '<ul class="cl"><li><input type="checkbox" contenteditable="false" checked="">EKG</li>' +
          '<li><input type="checkbox" contenteditable="false">Lab</li></ul>',
      ),
    ).toBe('☑ EKG\n☐ Lab');
  });
});

describe('displayTitle / previewText', () => {
  it('uses the typed title when there is one', () => {
    expect(displayTitle({ title: ' Obat jaga ', body: '<p>x</p>' })).toBe('Obat jaga');
    expect(previewText({ title: 'Obat', body: '<p>x</p><p>y</p>' })).toBe('x\ny');
  });

  it('otherwise the first line, which the preview then skips', () => {
    const note = { title: '', body: '<p></p><p>Follow up Bed 3</p><p>cek K</p>' };
    expect(displayTitle(note)).toBe('Follow up Bed 3');
    expect(previewText(note)).toBe('cek K');
  });

  it('strips a checklist marker from a derived title', () => {
    expect(displayTitle({ title: '', body: '<ul class="cl"><li data-checked="false">Lab</li></ul>' }))
      .toBe('Lab');
  });

  it('says so when there is nothing to show', () => {
    expect(displayTitle({ title: '', body: '<p><br></p>' })).toBe('Tanpa judul');
  });

  it('truncates a long first line', () => {
    const title = displayTitle({ title: '', body: 'x'.repeat(100) });
    expect(title).toHaveLength(60);
    expect(title.endsWith('…')).toBe(true);
  });
});

describe('checklistProgress', () => {
  it('counts both markups', () => {
    expect(
      checklistProgress(
        '<ul class="cl"><li data-checked="true">a</li><li data-checked="false">b</li></ul>' +
          '<ul class="cl"><li><input type="checkbox" checked="">c</li></ul>',
      ),
    ).toEqual({ done: 2, total: 3 });
  });

  it('is null for a note with no checklist', () => {
    expect(checklistProgress('<p>halo</p>')).toBeNull();
  });
});

describe('ordering', () => {
  const list = [
    resolved('a', { order: 0 }),
    resolved('b', { order: 1 }),
    resolved('c', { order: 2 }),
    resolved('d', { order: 3 }),
  ];

  it('a new note goes above everything', () => {
    expect(orderAtTop(list)).toBe(-1);
    expect(orderAtTop([])).toBe(0);
  });

  it('moving between two notes takes their midpoint', () => {
    expect(orderForMove(list, 'd', 'b', 'before')).toBe(0.5);
    expect(orderForMove(list, 'a', 'c', 'after')).toBe(2.5);
  });

  it('moving to either end steps past the end note', () => {
    expect(orderForMove(list, 'c', 'a', 'before')).toBe(-1);
    expect(orderForMove(list, 'a', 'd', 'after')).toBe(4);
  });

  it('a drop that changes nothing writes nothing', () => {
    expect(orderForMove(list, 'b', 'b', 'after')).toBeNull();
    expect(orderForMove(list, 'b', 'c', 'before')).toBeNull();
    expect(orderForMove(list, 'b', 'a', 'after')).toBeNull();
  });

  it('equal neighbours still produce a distinct order', () => {
    const tied = [resolved('a', { order: 1 }), resolved('b', { order: 1 }), resolved('c', { order: 5 })];
    const order = orderForMove(tied, 'c', 'a', 'after');
    expect(order).not.toBeNull();
    expect(order).toBeGreaterThan(1);
  });
});

describe('noteTone', () => {
  it('is stable and uses the card tokens', () => {
    expect(noteTone('n1')).toEqual(noteTone('n1'));
    expect(noteTone('nabc').bg).toMatch(/^var\(--card-step-\d+-bg\)$/);
    expect(noteTone('nabc').accent).toMatch(/^var\(--card-step-\d+-accent\)$/);
  });
});

describe('relativeTime', () => {
  const now = Date.UTC(2026, 8, 28, 10, 0);
  it('reads like a note app', () => {
    expect(relativeTime(0, now)).toBe('');
    expect(relativeTime(now - 20_000, now)).toBe('baru saja');
    expect(relativeTime(now - 12 * 60_000, now)).toBe('12 mnt');
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe('3 jam');
    expect(relativeTime(now - 30 * 3_600_000, now)).toBe('kemarin');
    expect(relativeTime(Date.UTC(2026, 7, 2), now)).toBe('2 Agu');
  });
});

describe('archived jaga notes are a log (2026-09-29)', () => {
  it('are ordered by when they were made, newest first, whatever the manual order', () => {
    const notes = [
      resolved('old', { category: 'jaga', archived: true, createdAt: 100, order: -5 }),
      resolved('new', { category: 'jaga', archived: true, createdAt: 300, order: 9 }),
      resolved('mid', { category: 'jaga', archived: true, createdAt: 200, order: 0 }),
    ];
    expect(notesForView(notes, 'jaga', 'arsip').map((n) => n.id)).toEqual(['new', 'mid', 'old']);
  });
});
