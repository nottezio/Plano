import { describe, expect, it } from 'vitest';

import { SNIPPETS, insertSnippet } from './snippets';

const byId = (id: string) => SNIPPETS.find((snippet) => snippet.id === id)!;

describe('snippets', () => {
  it('dates the EKG heading numerically, from the NOTE\u2019s clinical day', () => {
    // All-numeric and zero padded, matching every dated heading in the corpus.
    // The note's day, not today's wall clock: a note written after midnight
    // for the previous day must carry that day's date.
    expect(byId('ekg').build('2026-09-04', 'PJT Lantai 4')).toBe('*EKG PJT Lt. 4 (04-09-2026)*\n');
  });

  it('takes the floor from the ward, however it is written', () => {
    expect(byId('ekg').build('2026-10-01', 'PJT Lt 5')).toBe('*EKG PJT Lt. 5 (01-10-2026)*\n');
    expect(byId('ekg').build('2026-10-01', 'PJT Lt. 4')).toBe('*EKG PJT Lt. 4 (01-10-2026)*\n');
    expect(byId('ekg').build('2026-10-01', 'CVCU')).toBe('*EKG CVCU (01-10-2026)*\n');
  });

  it('leaves the floor blank when no ward is recorded', () => {
    expect(byId('ekg').build('2026-09-04')).toBe('*EKG PJT Lt. ... (04-09-2026)*\n');
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

describe('pemeriksaan fisik snippet', () => {
  const out = byId('pemeriksaan-fisik').build('2026-09-05');

  it('leaves every measured number blank', () => {
    // A prefilled vital sign nobody replaced is a fabricated observation in a
    // clinical record.
    expect(out).toContain('Tekanan Darah : ... mmHg');
    expect(out).toContain('Nadi : ... kali/menit, reguler');
    expect(out).toContain('Suhu : ... derajat Celcius');
    expect(out).toContain('SpO2 : ... % on room air');
    // No stray digits among the vitals block.
    expect(out.split('\n\n')[0]).not.toMatch(/\d+\/\d+/);
  });

  it('keeps the examination findings prefilled', () => {
    // These are the normal findings; the work is editing the abnormal few.
    expect(out).toContain('JVP R+2 cmH20');
    expect(out).toContain('BJ I/II murni reguler, murmur tidak terdengar');
    expect(out).toContain('Edema ekstremitas tidak ada, akral hangat, CTR < 2 detik');
  });
});

describe('A / T + Plan / Laboratorium snippets (added 18 Oct 2026)', () => {
  it('heads the lab block with the floor and the note’s day, like the EKG', () => {
    expect(byId('laboratorium').build('2026-10-18', 'PJT Lantai 5')).toBe(
      '*Laboratorium PJT Lt. 5 (18-10-2026)*\n',
    );
    expect(byId('laboratorium').build('2026-10-18', 'CVCU')).toBe('*Laboratorium CVCU (18-10-2026)*\n');
    expect(byId('laboratorium').build('2026-10-18')).toBe('*Laboratorium PJT Lt. ... (18-10-2026)*\n');
  });

  it('writes the A heading the way the templates do', () => {
    expect(byId('assess').build('2026-10-18')).toBe('*Mohon izin kami assess dengan:*\n- \n');
  });

  it('writes T and Plan together, both bullets empty', () => {
    expect(byId('terapi-plan').build('2026-10-18')).toBe(
      '*Mohon izin kami terapi dengan:*\n- \n\n*Plan:*\n- \n',
    );
  });

  it('puts the caret on the FIRST empty bullet, not the end of the block', () => {
    const snippet = byId('terapi-plan');
    const result = insertSnippet('O\n', 2, snippet.build('2026-10-18'), snippet.caretAfter);
    expect(result.text.slice(0, result.selectionStart)).toBe('O\n*Mohon izin kami terapi dengan:*\n- ');
    expect(result.selectionEnd).toBe(result.selectionStart);
  });

  it('accounts for the line break added mid-sentence when placing the caret', () => {
    const snippet = byId('assess');
    const result = insertSnippet('ekg sinus', 9, snippet.build('2026-10-18'), snippet.caretAfter);
    expect(result.text).toBe('ekg sinus\n*Mohon izin kami assess dengan:*\n- \n');
    expect(result.text.slice(0, result.selectionStart)).toBe('ekg sinus\n*Mohon izin kami assess dengan:*\n- ');
  });

  it('lists the blocks in note order: S, O, studies, A, T/Plan', () => {
    expect(SNIPPETS.map((s) => s.id)).toEqual([
      'keluhan-pendek',
      'anamnesis',
      'pemeriksaan-fisik',
      'faktor-risiko',
      'ekg',
      'laboratorium',
      'assess',
      'terapi-plan',
    ]);
  });
});
