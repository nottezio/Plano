import { describe, expect, it } from 'vitest';

import { autoMatches, DEFAULT_NEW_BADGE, hueColor, isMarkColor, markCss, markInfo, newBadgeOf, newMarkId, oklchHex, printedTags, readMarks, readNewBadge, tagsOf } from './marks';

describe('colour wheel (11 Nov 2026)', () => {
  it('stores a hue as "h<deg>", reads it back, and rejects anything else', () => {
    expect(hueColor(370)).toBe('h10');
    expect(hueColor(-5)).toBe('h355');
    expect(isMarkColor('h200')).toBe(true);
    expect(isMarkColor('h360')).toBe(false);
    expect(isMarkColor('#ff0000')).toBe(false);
    expect(readMarks([{ id: 'a', label: 'Pre-op', color: 'h200' }])[0]?.color).toBe('h200');
  });

  it('draws with the theme lightness and prints a matching Word colour', () => {
    expect(markCss('h200')).toBe('oklch(var(--hue-l) var(--hue-c) 200)');
    expect(markCss('teal')).toBe('var(--mark-teal)');
    expect(oklchHex(1, 0, 0)).toBe('FFFFFF');
    expect(oklchHex(0, 0, 0)).toBe('000000');
    expect(markInfo('h200').docx).toMatch(/^[0-9A-F]{6}$/);
    expect(markInfo('blue').docx).toBe('0070C0');
  });
});

describe('floor marks', () => {
  it('reads only well-formed marks: known colour, a label, a unique id', () => {
    const raw = [
      { id: 'k1', label: ' Pre-op ', color: 'purple' },
      { id: 'k1', label: 'Dobel', color: 'blue' },
      { id: 'k2', label: '', color: 'blue' },
      { id: 'k3', label: 'Ungu?', color: '#ff00ff' },
      'sampah',
    ];
    expect(readMarks(raw)).toEqual([{ id: 'k1', label: 'Pre-op', color: 'purple' }]);
    expect(readMarks(undefined)).toEqual([]);
  });

  it('reads a rule; a DPJP rule without DPJPs is dropped', () => {
    expect(readMarks([{ id: 'k1', label: 'NP', color: 'teal', auto: { kind: 'dpjp', ids: ['np'] } }])[0]!.auto).toEqual({ kind: 'dpjp', ids: ['np'] });
    expect(readMarks([{ id: 'k1', label: 'NP', color: 'teal', auto: { kind: 'dpjp', ids: [] } }])[0]!.auto).toBeUndefined();
    expect(readMarks([{ id: 'k1', label: 'X', color: 'teal', auto: { kind: 'apa' } }])[0]!.auto).toBeUndefined();
  });

  it('rules match their facts', () => {
    const facts = { isNew: false, dpjpId: 'yp', btkv: true, kjs: false, division: false, junior: '' };
    expect(autoMatches({ kind: 'dpjp', ids: ['yp', 'aau'] }, facts)).toBe(true);
    expect(autoMatches({ kind: 'baru' }, facts)).toBe(false);
    expect(autoMatches({ kind: 'btkv' }, facts)).toBe(true);
    expect(autoMatches({ kind: 'tanpa-junior' }, facts)).toBe(true);
    expect(autoMatches({ kind: 'tanpa-junior' }, { ...facts, division: true })).toBe(false);
  });

  it('a screen-only mark keeps its flag through reading and onto the tag (13.12)', () => {
    const marks = readMarks([{ id: 'k1', label: 'Cek SOAP', color: 'grey', print: false }, { id: 'k2', label: 'Pre-op', color: 'purple' }]);
    expect(marks.map((m) => m.print)).toEqual([false, undefined]);
    const facts = { isNew: false, dpjpId: null, btkv: false, kjs: false, division: false, junior: '' };
    const tags = tagsOf(marks, ['k1', 'k2'], [], facts);
    expect(printedTags(tags).map((t) => t.label)).toEqual(['Pre-op']);
  });

  it('the "Pasien baru" rule retired into the badge: no tag, and the badge takes its text and colour (10 Nov 2026)', () => {
    const marks = readMarks([{ id: 'k1', label: 'Baru', color: 'blue', auto: { kind: 'baru' } }]);
    const facts = { isNew: true, dpjpId: null, btkv: false, kjs: false, division: false, junior: '' };
    expect(tagsOf(marks, [], [], facts)).toEqual([]);
    expect(newBadgeOf({ marks, newBadge: null })).toEqual({ label: 'Baru', color: 'blue', on: true });
    expect(newBadgeOf({ marks: [], newBadge: null })).toEqual(DEFAULT_NEW_BADGE);
    expect(newBadgeOf({ marks, newBadge: { label: 'Pindahan', color: 'pink', on: false } }).label).toBe('Pindahan');
    expect(readNewBadge({ label: '  ', color: 'nope' })).toBeNull();
    expect(readNewBadge({ label: '', color: 'teal' })).toEqual({ ...DEFAULT_NEW_BADGE, color: 'teal' });
  });

  it('"Tidak di-follow up" survives reading and reaches the tag; printing is its own choice (9 Nov 2026)', () => {
    const marks = readMarks([
      { id: 'k1', label: 'Titipan', color: 'grey', noFollowUp: true, print: false },
      { id: 'k2', label: 'Tidak FU', color: 'teal', noFollowUp: true },
      { id: 'k3', label: 'Pre-op', color: 'purple', noFollowUp: 'ya' },
    ]);
    expect(marks.map((m) => m.noFollowUp)).toEqual([true, true, undefined]);
    const facts = { isNew: false, dpjpId: null, btkv: false, kjs: false, division: false, junior: '' };
    const tags = tagsOf(marks, ['k1', 'k2', 'k3'], [], facts);
    expect(tags.map((t) => t.noFollowUp)).toEqual([true, true, undefined]);
    expect(printedTags(tags).map((t) => t.label)).toEqual(['Tidak FU', 'Pre-op']);
  });

  it('makes ids that are not taken', () => {
    const marks = readMarks([{ id: 'k2', label: 'Konsul', color: 'teal' }]);
    expect(newMarkId(marks)).toBe('k3');
    expect(newMarkId([{ id: 'k1', label: 'a', color: 'grey' }, { id: 'k2', label: 'b', color: 'grey' }])).toBe('k3');
  });
});
