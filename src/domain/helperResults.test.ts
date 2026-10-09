import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  MAX_RESULT_CHARS,
  defaultTitle,
  filterResults,
  groupByForDate,
  helperResultId,
  liveResults,
  readHelperResult,
  saveState,
  type HelperResult,
} from './helperResults';

const RULES = readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8');

function result(over: Partial<HelperResult> = {}): HelperResult {
  return {
    id: 'x',
    kind: 'sensus',
    forDate: '2026-10-09',
    subject: 'ARB',
    title: 'Sensus ARB',
    text: 'Total Pasien : 3 pasien',
    savedAt: 1000,
    editedAt: null,
    deletedAt: null,
    ...over,
  };
}

describe('helperResultId', () => {
  it('is the same for the same kind, date and subject — one record, not copies', () => {
    expect(helperResultId('sensus', '2026-10-09', 'ARB')).toBe(helperResultId('sensus', '2026-10-09', 'arb'));
    expect(helperResultId('sensus', '2026-10-09', 'ARB')).not.toBe(helperResultId('sensus', '2026-10-10', 'ARB'));
    expect(helperResultId('sensus', '2026-10-09', 'ARB')).not.toBe(helperResultId('sensus', '2026-10-09', 'MZ'));
  });

  it('never makes an id Firestore refuses', () => {
    for (const subject of ['', '/', '..', '__x__', 'a/b c', '  ', 'Malam / Siang']) {
      const id = helperResultId('formasi', '2026-10-09', subject);
      expect(id).not.toContain('/');
      expect(id).not.toMatch(/^__.*__$/);
      expect(id === '.' || id === '..').toBe(false);
      expect(id.length).toBeLessThan(100);
    }
  });
});

describe('readHelperResult', () => {
  it('reads a stored record', () => {
    expect(
      readHelperResult('id1', {
        kind: 'mr-prodi',
        forDate: '2026-10-09',
        subject: '',
        title: 'Laporan',
        text: 'hi',
        savedAt: 5,
        editedAt: null,
        deletedAt: null,
      }),
    ).toMatchObject({ id: 'id1', kind: 'mr-prodi', title: 'Laporan', savedAt: 5, deletedAt: null });
  });

  it('skips shapes it does not know instead of crashing', () => {
    expect(readHelperResult('a', null)).toBeNull();
    expect(readHelperResult('a', { kind: 'future-kind', forDate: '2026-10-09', text: '' })).toBeNull();
    expect(readHelperResult('a', { kind: 'sensus', forDate: '9/10/2026', text: '' })).toBeNull();
    expect(readHelperResult('a', { kind: 'sensus', forDate: '2026-10-09', text: 3 })).toBeNull();
  });

  it('fills a missing title and treats a non-number deletedAt as live', () => {
    const read = readHelperResult('a', { kind: 'sensus', forDate: '2026-10-09', text: 't', subject: 'MZ', deletedAt: 'x' });
    expect(read?.title).toBe(defaultTitle('sensus', 'MZ'));
    expect(read?.deletedAt).toBeNull();
    expect(read?.savedAt).toBe(0);
  });
});

describe('liveResults / filterResults / groupByForDate', () => {
  const list = [
    result({ id: 'a', savedAt: 1 }),
    result({ id: 'b', savedAt: 3, kind: 'formasi', title: 'Formasi Jaga', text: 'Jaga malam', forDate: '2026-10-08' }),
    result({ id: 'c', savedAt: 2, deletedAt: 9 }),
    result({ id: 'd', savedAt: 4, kind: 'mr-pakar', title: 'MR', text: 'Pengampu dr. X' }),
  ];

  it('drops deleted ones and puts the newest first', () => {
    expect(liveResults(list).map((r) => r.id)).toEqual(['d', 'b', 'a']);
  });

  it('filters by tool and by text in the title or body', () => {
    const live = liveResults(list);
    expect(filterResults(live, 'jaga', '').map((r) => r.id)).toEqual(['b']);
    expect(filterResults(live, 'mr', '').map((r) => r.id)).toEqual(['d']);
    expect(filterResults(live, null, 'pengampu').map((r) => r.id)).toEqual(['d']);
    expect(filterResults(live, null, 'ARB').map((r) => r.id)).toEqual(['a']);
  });

  it('groups by the date the result is for, newest date first', () => {
    expect(groupByForDate(liveResults(list)).map(([date, items]) => [date, items.map((r) => r.id)])).toEqual([
      ['2026-10-09', ['d', 'a']],
      ['2026-10-08', ['b']],
    ]);
  });
});

describe('saveState', () => {
  it('is new when nothing is saved or the saved one was deleted', () => {
    expect(saveState(undefined, 'x')).toBe('new');
    expect(saveState(result({ deletedAt: 5 }), 'x')).toBe('new');
  });

  it('ignores trailing whitespace; any other difference is a change', () => {
    expect(saveState(result({ text: 'abc\n' }), 'abc')).toBe('same');
    expect(saveState(result({ text: 'abc' }), 'abd')).toBe('changed');
  });
});

describe('firestore.rules agrees', () => {
  it('bounds the text at MAX_RESULT_CHARS and never allows a hard delete', () => {
    const block = RULES.slice(RULES.indexOf('match /helperResults/'));
    const body = block.slice(0, block.indexOf('match /templates/'));
    expect(body).toContain(`text.size() <= ${MAX_RESULT_CHARS}`);
    expect(body).toContain('allow delete: if false');
  });
});
