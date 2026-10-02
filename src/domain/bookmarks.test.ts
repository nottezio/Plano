import { describe, expect, it } from 'vitest';

import {
  bookmarkLabel,
  bookmarkOnLine,
  lineAt,
  reanchorBookmarks,
  resolveBookmark,
  resolveBookmarks,
  type LineBookmark,
} from './bookmarks';

const BODY = [
  '*S :*',
  '- Sesak berkurang',
  '',
  '*O :*',
  '- K 3,1',
  '- Cek DL',
  '',
  '*Planning*',
  '- Cek DL',
].join('\n');

const at = (text: string, nth = 0): LineBookmark => ({ text, nth, createdAt: '' });

describe('lineAt', () => {
  it('finds the line around an offset, trimmed, with its occurrence', () => {
    const offset = BODY.lastIndexOf('Cek DL');
    const line = lineAt(BODY, offset);
    expect(line.text).toBe('- Cek DL');
    expect(line.nth).toBe(1);
    expect(BODY.slice(line.start, line.end)).toBe('- Cek DL');
  });

  it('handles the first and last line and an empty one', () => {
    expect(lineAt(BODY, 0).text).toBe('*S :*');
    expect(lineAt(BODY, BODY.length).text).toBe('- Cek DL');
    expect(lineAt(BODY, BODY.indexOf('\n\n') + 1).text).toBe('');
  });
});

describe('resolveBookmark', () => {
  it('resolves by text and occurrence', () => {
    const second = resolveBookmark(BODY, at('- Cek DL', 1));
    expect(second?.start).toBe(BODY.lastIndexOf('- Cek DL'));
    const first = resolveBookmark(BODY, at('- Cek DL', 0));
    expect(first?.start).toBe(BODY.indexOf('- Cek DL'));
  });

  it('falls back to the last copy when a duplicate above is gone', () => {
    const one = BODY.replace('- Cek DL\n', '');
    expect(resolveBookmark(one, at('- Cek DL', 1))?.start).toBe(one.indexOf('- Cek DL'));
  });

  it('is null when the line is not in this note', () => {
    expect(resolveBookmark(BODY, at('- Troponin'))).toBeNull();
  });

  it('ignores indentation and trailing spaces', () => {
    expect(resolveBookmark('a\n   - K 3,1  \nb', at('- K 3,1'))?.start).toBe(2);
  });
});

describe('resolveBookmarks', () => {
  it('orders top to bottom, keeps the missing apart and merges duplicates', () => {
    const { resolved, missing } = resolveBookmarks(BODY, {
      b: at('- Cek DL', 1),
      a: at('- K 3,1'),
      c: at('- Hilang'),
      d: at('- K 3,1'),
    });
    expect(resolved.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(missing).toEqual(['c']);
  });
});

describe('bookmarkOnLine', () => {
  it('finds the bookmark on the caret line only', () => {
    const map = { x: at('- K 3,1') };
    expect(bookmarkOnLine(BODY, map, BODY.indexOf('3,1'))).toBe('x');
    expect(bookmarkOnLine(BODY, map, BODY.indexOf('Sesak'))).toBeNull();
  });
});

describe('bookmarkLabel', () => {
  it('drops bullets and emphasis and cuts long lines', () => {
    expect(bookmarkLabel('- K 3,1')).toBe('K 3,1');
    expect(bookmarkLabel('*Mohon izin kami assess dengan*')).toBe('Mohon izin kami assess…');
    expect(bookmarkLabel('2. _Cek_ DL')).toBe('Cek DL');
  });
});

describe('reanchorBookmarks', () => {
  it('follows an edit inside the bookmarked line', () => {
    const after = BODY.replace('- K 3,1', '- K 3,5 (koreksi KCl)');
    expect(reanchorBookmarks(BODY, after, { k: at('- K 3,1') })).toEqual({
      k: { text: '- K 3,5 (koreksi KCl)', nth: 0, createdAt: '' },
    });
  });

  it('leaves untouched bookmarks out of the result', () => {
    const after = `Baris baru\n${BODY}`;
    expect(reanchorBookmarks(BODY, after, { k: at('- K 3,1') })).toEqual({});
  });

  it('does not hand a deleted line to its neighbour', () => {
    const after = BODY.replace('- K 3,1\n', '');
    expect(reanchorBookmarks(BODY, after, { k: at('- K 3,1') })).toEqual({});
  });

  it('keeps the occurrence when the edited line is a repeat', () => {
    const last = BODY.lastIndexOf('- Cek DL');
    const after = `${BODY.slice(0, last)}- Cek DL, elektrolit`;
    expect(reanchorBookmarks(BODY, after, { p: at('- Cek DL', 1) })).toEqual({
      p: { text: '- Cek DL, elektrolit', nth: 0, createdAt: '' },
    });
  });
});
