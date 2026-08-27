import { describe, expect, it } from 'vitest';

import {
  findOpeningLine,
  replaceClosing,
  replaceGreeting,
  replaceOpeningLine,
  replaceOpeningSentence,
  splitOpening,
  suggestGreetingIndex,
  useDokterForm,
  useProfForm,
} from './opening';

const OPENING =
  "Assalamu'alaikum dokter. Tabe dokter, mohon izin melaporkan follow up pasien di *PJT Lantai 5 Kamar 516 Bed 2*  atas nama :";

const BODY = [OPENING, '', '*Tn. Abdullah / 59 tahun / RM 1667031*', '', '*S:*', '- nyeri dada tidak ada'].join('\n');

describe('findOpeningLine', () => {
  it('finds the first non-empty line', () => {
    expect(findOpeningLine(BODY)?.text).toBe(OPENING);
  });

  it('skips leading blank lines', () => {
    expect(findOpeningLine(`\n\n  \n${OPENING}`)?.text).toBe(OPENING);
  });

  it('returns null for an empty body', () => {
    expect(findOpeningLine('   \n\n')).toBeNull();
  });
});

describe('splitOpening', () => {
  it('splits greeting from reporting sentence', () => {
    const { greeting, rest } = splitOpening(OPENING);
    expect(greeting).toBe("Assalamu'alaikum dokter.");
    expect(rest.startsWith('Tabe dokter, mohon izin melaporkan follow up')).toBe(true);
  });

  it('treats a line with no terminator as all report, no greeting', () => {
    expect(splitOpening('Mohon izin melaporkan pasien')).toEqual({
      greeting: '',
      rest: 'Mohon izin melaporkan pasien',
    });
  });
});

describe('replaceGreeting', () => {
  it('swaps only the greeting', () => {
    const next = replaceGreeting(BODY, 'Selamat pagi dokter.');
    expect(next).toContain('Selamat pagi dokter. Tabe dokter, mohon izin melaporkan follow up');
    expect(next).not.toContain("Assalamu'alaikum");
  });

  it('leaves every line below the opening byte-identical', () => {
    const next = replaceGreeting(BODY, 'Selamat malam dokter.');
    const tail = (text: string): string => text.slice(text.indexOf('\n'));
    expect(tail(next)).toBe(tail(BODY));
  });

  it('prepends when the note is empty rather than losing the greeting', () => {
    expect(replaceGreeting('', 'Selamat pagi dokter.')).toBe('Selamat pagi dokter.\n\n');
  });
});

describe('replaceOpeningSentence', () => {
  it('swaps the reporting sentence and keeps the greeting', () => {
    const next = replaceOpeningSentence(
      BODY,
      'Tabe dokter, mohon izin melaporkan pasien baru rencana tindakan dari *POLI 1* di *PJT Lantai 5 Kamar 510 Bed 5* atas nama:',
    );
    expect(next.startsWith("Assalamu'alaikum dokter. Tabe dokter, mohon izin melaporkan pasien baru")).toBe(true);
    expect(next).toContain('POLI 1');
    expect(next).not.toContain('follow up pasien');
  });

  it('does not touch the identity line below it', () => {
    const next = replaceOpeningSentence(BODY, 'Mohon izin melaporkan.');
    expect(next).toContain('*Tn. Abdullah / 59 tahun / RM 1667031*');
  });
});

describe('replaceOpeningLine', () => {
  it('replaces the whole line', () => {
    const next = replaceOpeningLine(BODY, 'Halo dokter.');
    expect(next.split('\n')[0]).toBe('Halo dokter.');
    expect(next).toContain('*S:*');
  });

  it('preserves blank runs and trailing spaces further down', () => {
    const spaced = `${OPENING}\n\n\n*S:*   \n- x`;
    const next = replaceOpeningLine(spaced, 'Halo.');
    expect(next).toBe(`Halo.\n\n\n*S:*   \n- x`);
  });
});

describe('suggestGreetingIndex', () => {
  const greetings = [
    "Assalamu'alaikum dokter.",
    'Selamat pagi dokter.',
    'Selamat siang dokter.',
    'Selamat malam dokter.',
  ];

  it('suggests by time of day', () => {
    expect(greetings[suggestGreetingIndex(greetings, 8)]).toBe('Selamat pagi dokter.');
    expect(greetings[suggestGreetingIndex(greetings, 13)]).toBe('Selamat siang dokter.');
    expect(greetings[suggestGreetingIndex(greetings, 21)]).toBe('Selamat malam dokter.');
  });

  it('falls back to the first entry when nothing matches', () => {
    expect(suggestGreetingIndex(["Assalamu'alaikum dokter."], 8)).toBe(0);
  });
});

describe('replaceClosing', () => {
  const NOTE = ['*S:*', '- nyeri dada tidak ada', '', 'Tabe terimakasih dokter'].join('\n');

  it('swaps a closing that is already there', () => {
    const next = replaceClosing(NOTE, 'Selanjutnya mohon arahan Prof. Terima kasih Prof');
    expect(next).toContain('Selanjutnya mohon arahan Prof. Terima kasih Prof');
    expect(next).not.toContain('Tabe terimakasih dokter');
  });

  it('leaves every line above it byte-identical', () => {
    const next = replaceClosing(NOTE, 'Selanjutnya mohon arahan dokter. Terima kasih dokter');
    const head = (text: string): string => text.slice(0, text.lastIndexOf('\n'));
    expect(head(next)).toBe(head(NOTE));
  });

  it('appends rather than overwriting when there is no closing', () => {
    // The last line of a note without a closing is usually a plan item.
    // Overwriting it would delete a finding.
    const noClosing = '*Plan :*\n- Monitoring tanda vital';
    const next = replaceClosing(noClosing, 'Terima kasih dokter');
    expect(next).toContain('- Monitoring tanda vital');
    expect(next.trimEnd().endsWith('Terima kasih dokter')).toBe(true);
  });

  it('recognises the Prof variants as closings', () => {
    const withProf = '*Plan :*\n- x\n\nMohon arahanta Prof, terima kasih Prof';
    const next = replaceClosing(withProf, 'Terima kasih dokter');
    expect(next).not.toContain('arahanta Prof');
    expect(next).toContain('- x');
  });

  it('handles an empty note', () => {
    expect(replaceClosing('', 'Terima kasih dokter')).toBe('Terima kasih dokter');
  });
});

describe('Prof and dokter forms', () => {
  it('swaps every address in one pass', () => {
    // Getting one of the three wrong in a message to a professor reads as
    // carelessness, and doing it by hand means remembering all three.
    const note = 'Selamat pagi dokter. Tabe dokter, melaporkan…\n\nTerima kasih dokter';
    const prof = useProfForm(note);
    expect(prof).toBe('Selamat pagi prof. Tabe prof, melaporkan…\n\nTerima kasih prof');
  });

  it('preserves case', () => {
    expect(useProfForm('Dokter yang terhormat')).toBe('Prof yang terhormat');
  });

  it('leaves dr. and Dr. alone — those are titles, not address', () => {
    const dpjp = '_DPJP Utama : Dr. dr. Az Hafid Nashar, Sp.JP(K)_';
    expect(useProfForm(dpjp)).toBe(dpjp);
  });

  it('goes back again', () => {
    const note = 'Selamat pagi prof. Terima kasih prof';
    expect(useDokterForm(note)).toBe('Selamat pagi dokter. Terima kasih dokter');
  });
})
