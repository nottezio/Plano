import { describe, expect, it } from 'vitest';

import { diffRevision, diffWords, normaliseForRevision } from './revisionDiff';

const MINE = [
  'Assalamualaikum prof. Tabe prof, mohon izin melaporkan follow up pasien:',
  '',
  '*S :*',
  '- nyeri dada tidak ada',
  '',
  '*Mohon izin kami assess dengan*',
  '- CAD 2VD post PTCA 1 DEB di RCA',
  '',
  '*Mohon izin kami terapi dengan*',
  '- Aspilet 80 mg/24 jam/oral',
  '- Bisoprolol 1.25 mg/24 jam/oral',
  '- Atorvastatin 20 mg/24 jam/oral',
].join('\n');

const ON = { ignoreFormatting: true };
const OFF = { ignoreFormatting: false };

describe('diffRevision', () => {
  it('finds nothing when only the route changed the formatting', () => {
    // As it comes back from SIMGOS: no markers, CRLF, no blank lines, NBSP.
    const roundTrip = MINE.replace(/\*/g, '')
      .split('\n')
      .filter((line) => line.trim())
      .join('\r\n')
      .replace('Aspilet 80', 'Aspilet\u00A080');
    expect(diffRevision(MINE, roundTrip, ON).identical).toBe(true);
  });

  it('reports those same differences when formatting is NOT ignored', () => {
    expect(diffRevision(MINE, MINE.replace(/\*/g, ''), OFF).identical).toBe(false);
  });

  it('shows an edited dose as one changed row, with only the number marked', () => {
    const revised = MINE.replace('Atorvastatin 20 mg', 'Atorvastatin 40 mg');
    const diff = diffRevision(MINE, revised, ON);
    expect(diff).toMatchObject({ changed: 1, added: 0, removed: 0 });
    const row = diff.rows.find((candidate) => candidate.kind === 'changed');
    expect(row).toEqual({
      kind: 'changed',
      parts: [
        { type: 'equal', text: '- Atorvastatin ' },
        { type: 'delete', text: '20' },
        { type: 'insert', text: '40' },
        { type: 'equal', text: ' mg/24 jam/oral' },
      ],
    });
  });

  it('shows a new drug as added and a dropped one as removed', () => {
    const revised = MINE.replace('- Bisoprolol 1.25 mg/24 jam/oral\n', '').concat(
      '\n- Clopidogrel 75 mg/24 jam/oral',
    );
    const diff = diffRevision(MINE, revised, ON);
    expect(diff).toMatchObject({ changed: 0, added: 1, removed: 1 });
    expect(diff.rows).toContainEqual({ kind: 'removed', text: '- Bisoprolol 1.25 mg/24 jam/oral' });
    expect(diff.rows).toContainEqual({ kind: 'added', text: '- Clopidogrel 75 mg/24 jam/oral' });
  });

  it('does not pair a line with an unrelated replacement', () => {
    const revised = MINE.replace('- nyeri dada tidak ada', '- sesak napas saat aktivitas berat');
    const diff = diffRevision(MINE, revised, ON);
    expect(diff).toMatchObject({ changed: 0, added: 1, removed: 1 });
  });

  it('keeps rows in note order around an edit', () => {
    const revised = MINE.replace('Aspilet 80', 'Aspilet 100').replace(
      '- Bisoprolol 1.25 mg/24 jam/oral\n',
      '',
    );
    const kinds = diffRevision(MINE, revised, ON)
      .rows.filter((row) => row.kind !== 'same')
      .map((row) => row.kind);
    expect(kinds).toEqual(['changed', 'removed']);
  });

  it('keeps unchanged lines, so the change can be read in context', () => {
    const diff = diffRevision(MINE, MINE.replace('20 mg', '40 mg'), ON);
    expect(diff.rows.filter((row) => row.kind === 'same').length).toBeGreaterThan(5);
  });
});

describe('diffWords', () => {
  it('marks whole words, not stray letters', () => {
    expect(diffWords('H-2 rawat', 'H-3 rawat')).toEqual([
      { type: 'delete', text: 'H-2' },
      { type: 'insert', text: 'H-3' },
      { type: 'equal', text: ' rawat' },
    ]);
  });
});

describe('normaliseForRevision', () => {
  it('always removes invisible characters and trailing spaces', () => {
    expect(normaliseForRevision('\u200B- a  \r\nb', OFF)).toBe('- a\nb');
  });
});
