import { describe, expect, it } from 'vitest';

import type { FloorPatient } from './report';
import { dpjpsOnFloor, isDpjpPatient, matchesPicked, matchesSearch, searchWords } from './search';

const P: FloorPatient = {
  key: 'rm:123456',
  rm: '123456',
  name: 'Tn. Contoh Satu',
  identity: 'Tn. Contoh Satu/58 th/RM 123456',
  room: '417',
  bed: '2',
  floor: '4',
  dpjpId: null,
  kjsDpjpIds: [],
  btkv: false,
  body: 'Diagnosis:\n- CHF NYHA III\nPlan:\n- Echo',
  full: '',
  chief: 'Kirana',
  junior: 'Bima',
  senderNick: 'Bima',
  sender: 'dr. Bima',
  sentAt: '2026-10-13T07:00',
  index: 0,
  discharge: 'tomorrow',
  tags: [{ label: 'Pre-op', color: 'purple' }],
};

const hit = (q: string): boolean => matchesSearch(P, searchWords(q));

describe('list / denah search', () => {
  it('finds by name, RM, room and bed in any spelling', () => {
    expect(hit('contoh')).toBe(true);
    expect(hit('SATU contoh')).toBe(true);
    expect(hit('3456')).toBe(true);
    expect(hit('417/2')).toBe(true);
    expect(hit('417 bed 2')).toBe(true);
    expect(hit('4172')).toBe(true);
  });

  it('finds by resident, diagnosis, colour word and floor mark', () => {
    expect(hit('bima')).toBe(true);
    expect(hit('kir')).toBe(true);
    expect(hit('chf')).toBe(true);
    expect(hit('h-1')).toBe(true);
    expect(hit('pre-op')).toBe(true);
  });

  it('every word must match; a word inside another word does not', () => {
    expect(hit('contoh dua')).toBe(false);
    expect(hit('ntoh')).toBe(false);
    // A hyphenated term is one phrase, not two loose words.
    expect(matchesSearch({ ...P, tags: undefined, body: 'Plan:\n- Prednison\n- Rencana operasi' }, searchWords('pre-op'))).toBe(false);
    expect(hit('')).toBe(true);
  });

  it('lists every DPJP on the floor A–Z, own and shared KJS patients', () => {
    const ks = { ...P, dpjpId: 'ks' };
    const shared = { ...P, key: 'rm:2', dpjpId: 'pt', kjsDpjpIds: ['ks'] };
    expect(dpjpsOnFloor([shared, ks])).toEqual(['ks', 'pt']);
    expect(isDpjpPatient(shared, 'ks')).toBe(true);
    expect(isDpjpPatient(ks, 'pt')).toBe(false);
  });

  it('highlights patients of ANY picked DPJP, and still applies other typed words', () => {
    const ks = { ...P, dpjpId: 'ks', kjsDpjpIds: [] };
    const pt = { ...P, key: 'rm:2', dpjpId: 'pt', kjsDpjpIds: [] };
    const im = { ...P, key: 'rm:3', dpjpId: 'im', kjsDpjpIds: [] };
    const picked = ['ks', 'pt'];
    expect([ks, pt, im].map((p) => matchesPicked(p, [], picked))).toEqual([true, true, false]);
    // Both codes typed and picked: neither is required as text.
    expect([ks, pt, im].map((p) => matchesPicked(p, searchWords('ks pt'), picked))).toEqual([true, true, false]);
    expect(matchesPicked(ks, searchWords('tidakadadimanapun'), picked)).toBe(false);
    // Nothing picked: the plain search, every word required.
    expect(matchesPicked(ks, searchWords('ks pt'), [])).toBe(false);
  });
});
