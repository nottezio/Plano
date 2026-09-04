import { describe, expect, it } from 'vitest';

import { SNIPPETS, insertSnippet } from './snippets';

const byId = (id: string) => SNIPPETS.find((snippet) => snippet.id === id)!;

describe('snippets', () => {
  it('dates the EKG heading numerically, from the NOTE\u2019s clinical day', () => {
    // All-numeric and zero padded, matching every dated heading in the corpus.
    // The note's day, not today's wall clock: a note written after midnight
    // for the previous day must carry that day's date.
    expect(byId('ekg').build('2026-09-04')).toBe('*EKG di PJT Lt. ... (04-09-2026)*\n');
  });

  it('leaves the EKG floor blank', () => {
    // A patient moves between Lantai 4, Lantai 5, CVCU and IGD in one stay,
    // and the tracing's floor is not something the record knows.
    expect(byId('ekg').build('2026-09-04')).toContain('Lt. ...');
  });

  it('writes the short complaint block', () => {
    const out = byId('keluhan-pendek').build('2026-09-04');
    expect(out).toContain('- Sekarang nyeri dada tidak ada, berdebar tidak ada, sesak nafas tidak ada.');
    expect(out).toContain('- BAB dan BAK kesan normal.');
  });

  it('leaves every blank as a visible hole', () => {
    // A template that guesses a value is worse than one that leaves a gap: the
    // gap is visible in the note and in the message to the chief.
    expect(byId('anamnesis').build('2026-09-01')).toContain('sejak ...');
    expect(byId('anamnesis').build('2026-09-01')).toContain('NRS (...)');
    expect(byId('faktor-risiko').build('2026-09-01')).toContain('Riwayat hipertensi ...');
  });

  it('writes the risk factors under their own heading', () => {
    const out = byId('faktor-risiko').build('2026-09-01');
    expect(out.startsWith('Faktor Risiko Kardiovaskular :')).toBe(true);
    expect(out).toContain('- Riwayat penyakit jantung di keluarga tidak ada');
  });
});

describe('insertSnippet', () => {
  it('inserts at the caret', () => {
    const result = insertSnippet('halo\n', 5, 'BLOK\n');
    expect(result.text).toBe('halo\nBLOK\n');
  });

  it('breaks the line when the caret sits mid-sentence', () => {
    // Otherwise the block runs into the end of an existing sentence.
    const result = insertSnippet('keluhan sesak', 13, 'BLOK\n');
    expect(result.text).toBe('keluhan sesak\nBLOK\n');
  });

  it('adds no break when the line is already empty', () => {
    const result = insertSnippet('halo\n\n', 6, 'BLOK\n');
    expect(result.text).toBe('halo\n\nBLOK\n');
  });

  it('adds no break at the very start of an empty note', () => {
    const result = insertSnippet('', 0, 'BLOK\n');
    expect(result.text).toBe('BLOK\n');
  });

  it('leaves the caret after the inserted block', () => {
    const result = insertSnippet('halo\n', 5, 'BLOK\n');
    expect(result.text.slice(0, result.selectionStart)).toBe('halo\nBLOK\n');
  });

  it('keeps whatever followed the caret', () => {
    const result = insertSnippet('atas\nbawah', 5, 'BLOK\n');
    expect(result.text).toBe('atas\nBLOK\nbawah');
  });
});
