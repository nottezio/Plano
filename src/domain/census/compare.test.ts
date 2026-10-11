import { describe, expect, it } from 'vitest';

import { compareCensus, splitCensusMessage } from './compare';
import { PLACE_LABEL, buildCensus, entryKey, parseSource } from './maker';

// Invented patients; the list shape is the PJT ward list's.
const LIST = [
  '*List Pasien Lantai 4*',
  '',
  '1. 401 Bed 1/ARB/Tn. Contoh Satu/01-01-1960/66 th/RM 1234567',
  'Diagnosis:',
  '- ADHF',
  '',
  '2. 402 Bed 2/ZD/Ny. Contoh Dua/01-01-1970/56 th/RM 2345678',
  'Diagnosis:',
  '- NSTEMI',
  '',
  '3. 403 Bed 3/ARB/Tn. Contoh Tiga/01-01-1980/46 th/RM 3456789',
  'Diagnosis:',
  '- AF RVR',
].join('\n');

describe('compareCensus', () => {
  const source = parseSource(LIST);

  it('records each patient’s lines in the pasted list', () => {
    expect(source.entries.map((entry) => entry.span)).toEqual([
      // The identity line through its diagnosis block, not the blank after it.
      { start: 2, end: 5 },
      { start: 6, end: 9 },
      { start: 10, end: 13 },
    ]);
  });

  it('pairs every block with its census row, in list order', () => {
    const rules = buildCensus({ sources: [source], code: 'ARB', date: '2026-10-11', address: 'dokter' });
    const rows = rules.entries.map((entry) => ({ key: entry.key, place: entry.place, identity: entry.asWritten, diagnoses: entry.diagnoses }));
    const result = compareCensus({ sources: [source], code: 'ARB', rows });
    expect(result.lists[0]!.map((block) => [block.owner, block.row])).toEqual([
      ['mine', 0],
      ['other', null],
      ['mine', 1],
    ]);
    expect(result.rows.map((row) => row.number)).toEqual([1, 2]);
    expect(result.missing).toEqual([]);
    expect(result.unmatched).toEqual([]);
  });

  it('shows a patient the census left out, and a row the lists do not have', () => {
    const rows = [
      { key: entryKey('RM 1234567'), place: 'LT4' as const, identity: 'Tn. Contoh Satu', diagnoses: ['ADHF'] },
      { key: 'rm:9999999', place: 'LT4' as const, identity: 'Tn. Tidak Ada', diagnoses: [] },
    ];
    const result = compareCensus({ sources: [source], code: 'ARB', rows });
    expect(result.missing.map((block) => block.entry.key)).toEqual(['rm:3456789']);
    expect(result.unmatched.map((row) => row.identity)).toEqual(['Tn. Tidak Ada']);
  });
});

describe('splitCensusMessage', () => {
  it('cuts the message at its place headings', () => {
    const message = [
      'Assalamualaikum. Tabe Dokter',
      '',
      '*Total Pasien : 2 pasien*',
      '',
      '*RSWS : 1 pasien*',
      '1. ARB / Tn. Contoh',
      'Diagnosis:',
      '- HHD',
      '',
      '*PJT Lt. 4 : 1 pasien*',
      '1. 401 Bed 1/ARB/Tn. Contoh Dua',
      '',
      'Tabe terima kasih dokter.',
    ].join('\n');
    const { intro, parts } = splitCensusMessage(message, PLACE_LABEL);
    expect(intro).toBe('Assalamualaikum. Tabe Dokter\n\n*Total Pasien : 2 pasien*');
    expect(parts.map((part) => [part.place, part.count])).toEqual([
      ['RSWS', 1],
      ['LT4', 1],
    ]);
    expect(parts[1]!.body).toBe('1. 401 Bed 1/ARB/Tn. Contoh Dua\n\nTabe terima kasih dokter.');
  });
});
