import { describe, expect, it } from 'vitest';

import {
  findMarkdownLeaks,
  findNonAsciiChars,
  findPlainTextLeaks,
  formatBody,
  toMarkdown,
  toPlain,
  toWhatsApp,
} from './formatters';
import {
  composeCopy,
  composeSection,
  identityLine,
  resolveRange,
  type CopyDay,
} from './composeCopy';
import { DEFAULT_SECTION_ALIASES } from '../sections/aliases';
import { makePatient } from '../testFactories';
import type { SectionId } from '../types';

const PATIENT = makePatient({
  name: 'Tn. Budi Santoso',
  age: 52,
  sex: 'L',
  mrn: '123456',
  ward: 'Melati',
  bed: '3B',
  admittedAt: '2026-08-03',
});

const BODY = [
  'S: sesak **berkurang**, batuk _berdahak_',
  'O:',
  'TTV: TD 130/80, N 92',
  'Penunjang: Hb 10.2',
  'A: Pneumonia komunitas',
  'P:',
  '- Lanjut O2 3 lpm',
  '- Cek DPL besok',
  'Th/ Ceftriaxone 2x1 g IV',
].join('\n');

const OPTIONS = {
  aliases: DEFAULT_SECTION_ALIASES,
  patient: PATIENT,
  includeIdentity: false,
  includeDateHeader: false,
  sections: 'all' as const,
};

describe('toWhatsApp', () => {
  it('converts bold to a single asterisk', () => {
    expect(toWhatsApp('sesak **berkurang**')).toBe('sesak *berkurang*');
  });

  it('leaves italic underscores alone', () => {
    expect(toWhatsApp('batuk _berdahak_')).toBe('batuk _berdahak_');
  });

  it('converts strikethrough to a single tilde', () => {
    expect(toWhatsApp('~~stop O2~~')).toBe('~stop O2~');
  });

  it('leaves hyphen bullets exactly as written', () => {
    // Real handovers are written and read with hyphens. An earlier version
    // converted these to `•`, and that is what arrived in the chief's chat.
    expect(toWhatsApp('- Lanjut O2\n- Cek DPL')).toBe('- Lanjut O2\n- Cek DPL');
  });

  it('preserves indentation on nested bullets', () => {
    expect(toWhatsApp('  - Cek DPL')).toBe('  - Cek DPL');
  });

  it('leaves numbered lists as they are', () => {
    expect(toWhatsApp('1. Lanjut O2')).toBe('1. Lanjut O2');
  });

  it('leaks no markdown from a realistic note', () => {
    expect(findMarkdownLeaks(toWhatsApp(BODY))).toEqual([]);
  });

  it('does not italicise underscores inside identifiers', () => {
    expect(toWhatsApp('hari_rawat dan TD_N_RR')).toBe('hari_rawat dan TD_N_RR');
  });

  it('leaves an unbalanced marker untouched rather than mangling it', () => {
    expect(toWhatsApp('nilai ** penting')).toBe('nilai ** penting');
    expect(toWhatsApp('dosis 2*1')).toBe('dosis 2*1');
  });

  it('does not span line breaks', () => {
    expect(toWhatsApp('**awal\nakhir**')).toBe('**awal\nakhir**');
  });
});

describe('toPlain', () => {
  it('strips every inline marker', () => {
    expect(toPlain('sesak **berkurang**, batuk _berdahak_, ~~stop~~')).toBe(
      'sesak berkurang, batuk berdahak, stop',
    );
  });

  it('keeps the line structure intact', () => {
    expect(toPlain('- Lanjut O2\n- Cek DPL')).toBe('- Lanjut O2\n- Cek DPL');
  });

  it('leaves clinical shorthand containing asterisks alone', () => {
    expect(toPlain('Ceftriaxone 2*1 g')).toBe('Ceftriaxone 2*1 g');
  });
});

describe('toMarkdown', () => {
  it('is identity — the stored model is already Markdown', () => {
    expect(toMarkdown(BODY)).toBe(BODY);
  });
});

describe('formatBody dispatch', () => {
  it('routes each format to its own formatter', () => {
    expect(formatBody('**x**', 'whatsapp')).toBe('*x*');
    expect(formatBody('**x**', 'plain')).toBe('x');
    expect(formatBody('**x**', 'markdown')).toBe('**x**');
  });
});

describe('composeCopy — all sections', () => {
  const days: CopyDay[] = [{ date: '2026-08-06', body: BODY }];

  it('is byte-faithful in plain format apart from marker removal', () => {
    const output = composeCopy(days, { ...OPTIONS, format: 'plain' });
    expect(output).toBe(toPlain(BODY));
  });

  it('does not normalise the resident’s own blank lines', () => {
    const spaced = 'S: sesak\n\n\n\nA: pneumonia';
    const output = composeCopy([{ date: '2026-08-06', body: spaced }], {
      ...OPTIONS,
      format: 'plain',
    });
    expect(output).toBe(spaced);
  });

  it('adds the identity line when asked', () => {
    const output = composeCopy(days, {
      ...OPTIONS,
      format: 'plain',
      includeIdentity: true,
    });
    expect(output.startsWith('Tn. Budi Santoso, 52th, L, RM 123456, Melati 3B')).toBe(true);
  });

  it('adds the date header with hari rawat when asked', () => {
    const output = composeCopy(days, {
      ...OPTIONS,
      format: 'plain',
      includeDateHeader: true,
    });
    // The middot folds to a hyphen in plain text: SIMGOS renders anything
    // outside its legacy encoding as `?`.
    expect(output).toContain('Kamis, 6 Agustus 2026 - Hari rawat ke-4');
  });
});

describe('composeCopy — section subsets', () => {
  const days: CopyDay[] = [{ date: '2026-08-06', body: BODY }];

  it('includes only the requested sections', () => {
    const output = composeCopy(days, {
      ...OPTIONS,
      format: 'plain',
      sections: ['a', 'p'] as SectionId[],
    });
    expect(output).toContain('A: Pneumonia komunitas');
    expect(output).toContain('P:');
    expect(output).not.toContain('sesak');
    expect(output).not.toContain('Hb 10.2');
  });

  it('emits sections in configured order, not note order', () => {
    const output = composeCopy(days, {
      ...OPTIONS,
      format: 'plain',
      sections: ['terapi', 's'] as SectionId[],
    });
    expect(output.indexOf('sesak')).toBeLessThan(output.indexOf('Ceftriaxone'));
  });

  it('normalises the gap between non-adjacent sections to one blank line', () => {
    const output = composeCopy(days, {
      ...OPTIONS,
      format: 'plain',
      sections: ['s', 'a'] as SectionId[],
    });
    expect(output).not.toMatch(/\n{3,}/);
    expect(output.split('\n\n')).toHaveLength(2);
  });

  it('keeps a requested heading even when nothing sits directly under it', () => {
    // `O:` here is a bare label whose values are their own sections. Emitting
    // the heading is right: a dated `*Laboratorium PJT (04-08-2026)*` parses
    // the same way, and dropping it would keep the values and lose the date.
    const output = composeCopy(days, {
      ...OPTIONS,
      format: 'plain',
      sections: ['o', 'a'] as SectionId[],
    });
    expect(output).toBe('O:\n\nA: Pneumonia komunitas');
  });

  it('never invents a header for the intro block', () => {
    const output = composeCopy([{ date: '2026-08-06', body: 'Tn. B, 52th\nA: pneumonia' }], {
      ...OPTIONS,
      format: 'plain',
      sections: ['_intro'] as SectionId[],
    });
    expect(output).toBe('Tn. B, 52th');
  });

  it('applies the WhatsApp formatter to a subset too', () => {
    const output = composeCopy(days, {
      ...OPTIONS,
      format: 'whatsapp',
      sections: ['s'] as SectionId[],
    });
    expect(output).toBe('S: sesak *berkurang*, batuk _berdahak_');
    expect(findMarkdownLeaks(output)).toEqual([]);
  });
});

describe('composeCopy — multiple days', () => {
  const days: CopyDay[] = [
    { date: '2026-08-05', body: 'A: pneumonia' },
    { date: '2026-08-06', body: 'A: pneumonia membaik' },
  ];

  it('forces a date header so days are distinguishable', () => {
    const output = composeCopy(days, { ...OPTIONS, format: 'plain' });
    expect(output).toContain('Rabu, 5 Agustus 2026');
    expect(output).toContain('Kamis, 6 Agustus 2026');
  });

  it('keeps chronological order', () => {
    const output = composeCopy(days, { ...OPTIONS, format: 'plain' });
    expect(output.indexOf('5 Agustus')).toBeLessThan(output.indexOf('6 Agustus'));
  });
});

describe('composeSection', () => {
  it('copies one section with its header as typed', () => {
    expect(composeSection(BODY, 'penunjang' as SectionId, 'plain', DEFAULT_SECTION_ALIASES)).toBe(
      'Penunjang: Hb 10.2',
    );
  });

  it('can omit the header', () => {
    expect(
      composeSection(BODY, 'penunjang' as SectionId, 'plain', DEFAULT_SECTION_ALIASES, false),
    ).toBe('Hb 10.2');
  });

  it('returns an empty string for a section this note does not have', () => {
    expect(composeSection(BODY, 'custom_konsul' as SectionId, 'plain', DEFAULT_SECTION_ALIASES)).toBe(
      '',
    );
  });
});

describe('resolveRange', () => {
  const available: CopyDay[] = [
    { date: '2026-08-03', body: 'a' },
    { date: '2026-08-04', body: 'b' },
    { date: '2026-08-05', body: 'c' },
    { date: '2026-08-06', body: 'd' },
  ];

  it('today picks exactly the current clinical day', () => {
    expect(resolveRange({ range: 'today' }, available, '2026-08-06')).toEqual([
      { date: '2026-08-06', body: 'd' },
    ]);
  });

  it('today yields nothing when the day has no entry yet', () => {
    expect(resolveRange({ range: 'today' }, available, '2026-08-09')).toEqual([]);
  });

  it('lastN returns the newest N in chronological order', () => {
    const result = resolveRange({ range: 'lastN', lastN: 2 }, available, '2026-08-06');
    expect(result.map((day) => day.date)).toEqual(['2026-08-05', '2026-08-06']);
  });

  it('lastN clamps to at least one day', () => {
    expect(resolveRange({ range: 'lastN', lastN: 0 }, available, '2026-08-06')).toHaveLength(1);
  });

  it('all returns every day chronologically', () => {
    expect(
      resolveRange({ range: 'all' }, available, '2026-08-06').map((day) => day.date),
    ).toEqual(['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06']);
  });

  it('specific picks the requested day', () => {
    expect(
      resolveRange({ range: 'specific' }, available, '2026-08-06', '2026-08-04'),
    ).toEqual([{ date: '2026-08-04', body: 'b' }]);
  });
});

describe('identityLine', () => {
  it('omits fields the record does not have', () => {
    expect(identityLine(makePatient({ name: 'Ny. Siti' }))).toBe('Ny. Siti');
  });
});

describe('single-asterisk bold pasted from WhatsApp', () => {
  const pasted = [
    '*S:*',
    '- nyeri dada tidak ada',
    '',
    '*EKG PJT Lantai 5 06-08-2026*',
    'Sinus bradikardi, HR 45 bpm',
    '',
    '_DPJP Utama : DR. dr. Az Hafid Nashar, SpJP (K)_',
  ].join('\n');

  it('strips it for SIMGOS — the whole point of plain text', () => {
    const plain = toPlain(pasted);
    expect(plain).toContain('S:');
    expect(plain).toContain('EKG PJT Lantai 5 06-08-2026');
    expect(plain).toContain('DPJP Utama : DR. dr. Az Hafid Nashar, SpJP (K)');
    expect(findPlainTextLeaks(plain)).toEqual([]);
  });

  it('leaves clinical shorthand with an asterisk alone', () => {
    expect(toPlain('Ceftriaxone 2*1 g IV')).toBe('Ceftriaxone 2*1 g IV');
    expect(toPlain('Metformin 500 mg 3*1')).toBe('Metformin 500 mg 3*1');
  });

  it('handles both spellings in the same note', () => {
    expect(toPlain('*tebal satu* dan **tebal dua**')).toBe('tebal satu dan tebal dua');
  });

  it('promotes it to real bold for Markdown, not italic', () => {
    expect(toMarkdown('*Penunjang*')).toBe('**Penunjang**');
    expect(toMarkdown('**sudah tebal**')).toBe('**sudah tebal**');
  });

  it('leaves WhatsApp output untouched — it is already the target format', () => {
    expect(toWhatsApp('*S:*')).toBe('*S:*');
  });

  it('does not treat a mid-line asterisk as bold', () => {
    expect(toPlain('nilai * penting')).toBe('nilai * penting');
  });

  it('reads a leading `* ` as a bullet, not as bold', () => {
    expect(toPlain('* awal saja')).toBe('- awal saja');
    expect(toWhatsApp('* awal saja')).toBe('- awal saja');
  });
});

describe('identity lines with trailing blanks', () => {
  it('strips asterisks even when the span ends in a space', () => {
    expect(toPlain('*Tn.  /  /  tahun / RM *')).toBe('Tn.  /  /  tahun / RM ');
  });

  it('strips a filled-in identity line', () => {
    expect(toPlain('*Tn. Abdullah / 11-04-1967/ 59 tahun/ RM 1667031*')).toBe(
      'Tn. Abdullah / 11-04-1967/ 59 tahun/ RM 1667031',
    );
  });

  it('strips the ward line with its blank placeholders', () => {
    const line = "Tabe dokter, melaporkan pasien di *Ruang  Kamar  Bed *  atas nama :";
    expect(findPlainTextLeaks(toPlain(line))).toEqual([]);
  });

  it('still refuses a span that starts with a space', () => {
    expect(toPlain('nilai * penting *')).toBe('nilai * penting *');
  });

  it('leaves multiplication shorthand alone', () => {
    expect(toPlain('Metformin 500 mg 3*1 dan Ceftriaxone 2*1')).toBe(
      'Metformin 500 mg 3*1 dan Ceftriaxone 2*1',
    );
  });
});

describe('asterisk bullets pasted from WhatsApp', () => {
  const list = ['* Clopidogrel 75mg', '* Miniaspi 80mg', '- Atorvastatin 20mg'].join('\n');

  it('normalises both bullet spellings to a hyphen', () => {
    expect(toWhatsApp(list)).toBe(
      ['- Clopidogrel 75mg', '- Miniaspi 80mg', '- Atorvastatin 20mg'].join('\n'),
    );
  });

  it('normalises both to `- ` for plain text', () => {
    expect(toPlain(list)).toBe(
      ['- Clopidogrel 75mg', '- Miniaspi 80mg', '- Atorvastatin 20mg'].join('\n'),
    );
  });

  it('preserves indentation', () => {
    expect(toWhatsApp('  * Cek DPL')).toBe('  - Cek DPL');
  });

  it('does not mistake bold at the start of a line for a bullet', () => {
    expect(toPlain('*Terapi:*')).toBe('Terapi:');
  });
});

describe('SIMGOS cannot render non-ASCII — it shows `?`', () => {
  it('folds the bullet the WhatsApp formatter emits', () => {
    expect(toPlain('• Clopidogrel')).toBe('- Clopidogrel');
  });

  it('folds curly quotes from phone autocorrect', () => {
    expect(toPlain('S\u2019 lateral 14 cm/s')).toBe("S' lateral 14 cm/s");
    expect(toPlain('\u201Cnyeri\u201D')).toBe('"nyeri"');
  });

  it('folds dashes, ellipsis and non-breaking spaces', () => {
    expect(toPlain('EF 55\u201360%')).toBe('EF 55-60%');
    expect(toPlain('lanjut\u2026')).toBe('lanjut...');
    expect(toPlain('TD\u00A0116/72')).toBe('TD 116/72');
  });

  it('folds degree and comparison symbols used in vitals', () => {
    expect(toPlain('Suhu 36.7\u00B0C')).toBe('Suhu 36.7 derajat C');
    expect(toPlain('eGFR \u2265 60')).toBe('eGFR >= 60');
  });

  it('leaves a realistic note fully ASCII', () => {
    const note = [
      '*O:*',
      '• TD 116/72 mmHg',
      'Suhu 36.7\u00B0C',
      'S\u2019 lateral 14 cm/s',
      'EF 55\u201360 %',
    ].join('\n');
    expect(findNonAsciiChars(toPlain(note))).toEqual([]);
  });
});

describe('bare bullets are content, not noise', () => {
  const withBare = ['Plan Diagnostik:', '-', '', 'Plan Monitoring:', '- Monitoring TTV'].join(
    '\n',
  );

  it('keeps a bullet with nothing after it', () => {
    // A bare `-` under a heading means "nothing here" in a real handover.
    // Removing it changes what the note says.
    expect(toWhatsApp(withBare)).toBe(withBare);
  });

  it('keeps it in plain text too', () => {
    expect(toPlain(withBare)).toBe(withBare);
  });
});

describe('WhatsApp rewrites `- ` into its own list — the guard stops it', () => {
  const list = '- Clopidogrel 75mg\n- Miniaspi 80mg';

  it('defaults to a plain hyphen when no style is given', () => {
    expect(toWhatsApp(list)).toBe(list);
  });

  it('stops the line beginning with a hyphen at all', () => {
    const output = toWhatsApp(list, 'guarded');
    // A zero-width space before the hyphen and a non-breaking space after it.
    // WhatsApp's list detection needs a line that STARTS with `- `; this one
    // does neither, while looking identical on screen.
    expect(output).toBe('\u200B-\u00A0Clopidogrel 75mg\n\u200B-\u00A0Miniaspi 80mg');
    expect(output).not.toMatch(/^- /m);
    expect(output).not.toMatch(/^\* /m);
  });

  it('normalises `* ` bullets through the guard too', () => {
    expect(toWhatsApp('* Cek DPL', 'guarded')).toBe('\u200B-\u00A0Cek DPL');
  });

  it('can still write a literal bullet character', () => {
    expect(toWhatsApp(list, 'bullet')).toBe('• Clopidogrel 75mg\n• Miniaspi 80mg');
  });

  it('folds the guard back to a normal space for SIMGOS', () => {
    // The NBSP is exactly the character SIMGOS renders as `?`.
    expect(toPlain(toWhatsApp(list, 'guarded'))).toBe(list);
    expect(findNonAsciiChars(toPlain(toWhatsApp(list, 'guarded')))).toEqual([]);
  });

  it('leaves a bare bullet alone in every style', () => {
    expect(toWhatsApp('-', 'guarded')).toBe('-');
  });
});
