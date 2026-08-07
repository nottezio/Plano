import { describe, expect, it } from 'vitest';

import {
  findOpeningLine,
  replaceGreeting,
  replaceOpeningLine,
  replaceOpeningSentence,
  splitOpening,
  suggestGreetingIndex,
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
