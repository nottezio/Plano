import { describe, expect, it } from 'vitest';

import {
  copyableSections,
  mergeSections,
  parseSections,
  sectionAt,
} from './parseSections';
import { DEFAULT_SECTION_ALIASES, validateAliases } from './aliases';
import type { SectionAlias } from '../types';

/** THE invariant (SPEC 12.1). Asserted against every body in this file. */
function assertLossless(body: string): ReturnType<typeof parseSections> {
  const sections = parseSections(body);
  expect(sections.map((section) => body.slice(section.start, section.end)).join('')).toBe(body);
  // Blocks must also be contiguous and start at 0 — "lossless AND total".
  let cursor = 0;
  for (const section of sections) {
    expect(section.start).toBe(cursor);
    cursor = section.end;
  }
  expect(cursor).toBe(body.length);
  return sections;
}

const REAL_NOTE = [
  'Tn. B, 52th, Melati 3B',
  '',
  'S: sesak berkurang, batuk berdahak',
  'O:',
  'TTV: TD 130/80, N 92, RR 24, S 37.1',
  'Penunjang: Hb 10.2, Leu 14.300',
  'Rontgen: infiltrat paru kanan',
  'A: Pneumonia komunitas',
  'P:',
  '- Lanjut O2 3 lpm',
  '- Cek DPL ulang besok',
  'Th/ Ceftriaxone 2x1 g IV',
].join('\n');

describe('losslessness — the parse is total and non-destructive', () => {
  const bodies: Array<[string, string]> = [
    ['empty', ''],
    ['single space', ' '],
    ['newline only', '\n'],
    ['no headers at all', 'pasien membaik, rencana pulang besok'],
    ['leading blank lines then a header', '\n\nS: sesak'],
    ['header on the very first character', 'S: sesak'],
    ['trailing newline', 'S: sesak\n'],
    ['CRLF line endings', 'S: sesak\r\nO: compos mentis\r\n'],
    ['duplicate headers', 'Penunjang: Hb 10\nA: anemia\nPenunjang: Ur/Cr 30/1.1'],
    ['unknown header', 'Konsul: TS Jantung\nS: sesak'],
    ['tabs and ragged spacing', 'S :\tsesak\n\n\nP  :  observasi'],
    ['a realistic full note', REAL_NOTE],
  ];

  for (const [name, body] of bodies) {
    it(`holds for ${name}`, () => {
      assertLossless(body);
    });
  }

  it('never mutates the body across a parse cycle (byte equality)', () => {
    const before = REAL_NOTE;
    const copy = String(before);
    parseSections(before);
    copyableSections(before);
    mergeSections(parseSections(before));
    expect(before).toBe(copy);
    expect(before.length).toBe(copy.length);
  });

  it('reconstructs each block exactly from headerLine + text', () => {
    for (const section of parseSections(REAL_NOTE)) {
      const block = REAL_NOTE.slice(section.start, section.end);
      expect(`${section.headerLine ?? ''}${section.text}`).toBe(block);
    }
  });

  it('emits no section that reformats what the user typed', () => {
    const messy = 's :   sesak   \n\n\nP.  observasi';
    for (const section of parseSections(messy)) {
      expect(messy).toContain(section.text);
    }
  });
});

describe('no headers', () => {
  it('returns a single _intro section labelled Catatan', () => {
    const sections = assertLossless('pasien membaik');
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({
      sectionId: '_intro',
      label: 'Catatan',
      headerLine: null,
      text: 'pasien membaik',
    });
  });

  it('does the same for an empty body', () => {
    const sections = assertLossless('');
    expect(sections).toHaveLength(1);
    expect(sections[0]?.sectionId).toBe('_intro');
    expect(sections[0]?.text).toBe('');
  });
});

describe('header detection', () => {
  it('detects the shipped aliases, case-insensitively', () => {
    const ids = parseSections('s: a\nO: b\nttv: c\nLAB: d\nA: e\np: f\nObat: g').map(
      (section) => section.sectionId,
    );
    expect(ids).toEqual(['s', 'o', 'ttv', 'penunjang', 'a', 'p', 'terapi']);
  });

  it('accepts the delimiters the spec allows', () => {
    expect(parseSections('S: a').map((s) => s.sectionId)).toEqual(['s']);
    expect(parseSections('S. a').map((s) => s.sectionId)).toEqual(['s']);
    expect(parseSections('S) a').map((s) => s.sectionId)).toEqual(['s']);
  });

  it('tolerates decoration: bullets, markdown bold, hashes, quotes', () => {
    for (const decorated of ['- S: a', '# S: a', '> S: a', '  S: a']) {
      expect(parseSections(decorated)[0]?.sectionId).toBe('s');
    }
  });

  it('still detects a header the user bolded with the toolbar', () => {
    // Both markdown-lite spellings a Bold press can produce.
    for (const bolded of ['**S**: a', '**S:** a', '_Penunjang_: Hb 10']) {
      expect(parseSections(bolded)[0]?.sectionId).not.toBe('_intro');
    }
    expect(parseSections('**Konsul**: TS Jantung')[0]?.sectionId).toBe('custom_konsul');
  });

  it('prefers the longest matching alias', () => {
    const sections = parseSections('Pemeriksaan Penunjang: Hb 10');
    expect(sections[0]?.sectionId).toBe('penunjang');
    expect(sections[0]?.headerLine).toBe('Pemeriksaan Penunjang: ');
    expect(sections[0]?.text).toBe('Hb 10');
  });

  it('treats "Th/" as self-delimiting — the way residents actually write it', () => {
    const sections = parseSections('Th/ Ceftriaxone 2x1');
    expect(sections[0]?.sectionId).toBe('terapi');
    expect(sections[0]?.text).toBe('Ceftriaxone 2x1');
  });

  it('keeps same-line content after the delimiter inside the section', () => {
    const sections = parseSections('Penunjang: Hb 10.2\nLeu 14.300');
    expect(sections[0]?.text).toBe('Hb 10.2\nLeu 14.300');
    expect(sections[0]?.headerLine).toBe('Penunjang: ');
  });

  it('puts text before the first header into _intro', () => {
    const sections = assertLossless('Tn. B, 52th\n\nS: sesak');
    expect(sections[0]?.sectionId).toBe('_intro');
    expect(sections[0]?.text).toBe('Tn. B, 52th\n\n');
    expect(sections[1]?.sectionId).toBe('s');
  });
});

describe('false positives — a loose parser invents structure', () => {
  const notHeaders: Array<[string, string]> = [
    ['a bare time', 'Pukul 14:30 pasien sesak'],
    ['a vitals line with a colon', '06:00 TD 120/80'],
    ['a URL', 'https://sim.rs/pasien/123'],
    ['a numbered list item', '1. Paracetamol 3x500mg'],
    ['a long phrase before a colon', 'Konsul ke teman sejawat bedah digestif anak: setuju'],
  ];

  for (const [name, body] of notHeaders) {
    it(`does not treat ${name} as a header`, () => {
      const sections = assertLossless(body);
      expect(sections).toHaveLength(1);
      expect(sections[0]?.sectionId).toBe('_intro');
    });
  }

  it('does not match an alias that only prefixes a longer word', () => {
    const sections = assertLossless('Antibiotik sudah diberikan');
    expect(sections[0]?.sectionId).toBe('_intro');
  });
});

describe('unknown headers become custom sections, never discarded', () => {
  it('slugs the id and keeps the user’s own casing as the label', () => {
    const sections = assertLossless('Konsul: TS Jantung setuju\nS: sesak');
    expect(sections[0]).toMatchObject({
      sectionId: 'custom_konsul',
      label: 'Konsul',
      text: 'TS Jantung setuju\n',
    });
  });

  it('handles multi-word custom headers up to three words', () => {
    expect(parseSections('Rencana Pulang Besok: siapkan resep')[0]?.sectionId).toBe(
      'custom_rencana_pulang_besok',
    );
  });

  it('offers custom sections in the copy UI automatically', () => {
    const labels = copyableSections('Konsul: TS Jantung\nS: sesak').map((s) => s.label);
    expect(labels).toContain('Konsul');
  });

  it('never drops the text even when nothing is recognised', () => {
    const body = 'Catatan bebas tanpa struktur apa pun';
    expect(copyableSections(body).map((s) => s.text).join('')).toBe(body);
  });
});

describe('duplicate headers', () => {
  const body = 'Penunjang: Hb 10\nA: anemia\nPenunjang: Ur/Cr 30/1.1';

  it('parses as separate contiguous blocks', () => {
    const sections = assertLossless(body);
    expect(sections.map((s) => s.sectionId)).toEqual(['penunjang', 'a', 'penunjang']);
  });

  it('merges into one sectionId in output order, retaining both ranges', () => {
    const merged = mergeSections(parseSections(body));
    const penunjang = merged.find((section) => section.sectionId === 'penunjang');
    expect(merged).toHaveLength(2);
    expect(penunjang?.blocks).toHaveLength(2);
    expect(penunjang?.text).toBe('Hb 10\nUr/Cr 30/1.1');
  });
});

describe('copyableSections', () => {
  it('orders by the configured alias order, not by position in the note', () => {
    const ids = copyableSections('P: observasi\nS: sesak\nA: pneumonia').map(
      (section) => section.sectionId,
    );
    expect(ids).toEqual(['s', 'a', 'p']);
  });

  it('places custom sections after every configured one', () => {
    const ids = copyableSections('Konsul: TS Jantung\nS: sesak').map((s) => s.sectionId);
    expect(ids).toEqual(['s', 'custom_konsul']);
  });

  it('skips sections whose content is empty or whitespace', () => {
    const ids = copyableSections('S: sesak\nO:\n\nA: pneumonia').map((s) => s.sectionId);
    expect(ids).toEqual(['s', 'a']);
  });
});

describe('alias configuration is live, not baked in', () => {
  const body = 'Kesan: pneumonia';

  it('re-parses the same body differently when aliases change', () => {
    expect(parseSections(body)[0]?.sectionId).toBe('custom_kesan');

    const custom: SectionAlias[] = [
      ...DEFAULT_SECTION_ALIASES.map((alias) => ({ ...alias, aliases: [...alias.aliases] })),
    ];
    const assessment = custom.find((alias) => alias.sectionId === 'a');
    assessment?.aliases.push('Kesan');

    expect(parseSections(body, custom)[0]?.sectionId).toBe('a');
    // The body itself is untouched — no migration is possible or needed.
    expect(body).toBe('Kesan: pneumonia');
  });

  it('cannot be broken by an empty alias table', () => {
    const sections = parseSections('S: sesak', []);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.sectionId).toBe('s');
  });

  it('does not shred the note when every alias is blank', () => {
    const blank: SectionAlias[] = [
      { sectionId: 's', label: 'Subjektif', order: 1, aliases: ['   '] },
    ];
    const sections = parseSections('sesak sejak 2 hari', blank);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.sectionId).toBe('_intro');
  });
});

describe('sectionAt', () => {
  it('finds the section containing a caret offset', () => {
    const sections = parseSections(REAL_NOTE);
    const offset = REAL_NOTE.indexOf('Pneumonia');
    expect(sectionAt(sections, offset)?.sectionId).toBe('a');
  });

  it('returns null past the end', () => {
    const sections = parseSections('S: sesak');
    expect(sectionAt(sections, 999)).toBeNull();
  });
});

describe('validateAliases', () => {
  it('accepts the shipped table', () => {
    expect(validateAliases(DEFAULT_SECTION_ALIASES).ok).toBe(true);
  });

  it('rejects a keyword claimed by two sections', () => {
    const clashing: SectionAlias[] = [
      { sectionId: 's', label: 'Subjektif', order: 1, aliases: ['Keluhan'] },
      { sectionId: 'a', label: 'Assessment', order: 2, aliases: ['keluhan'] },
    ];
    const result = validateAliases(clashing);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('dua bagian');
  });

  it('rejects a blank keyword', () => {
    expect(
      validateAliases([{ sectionId: 's', label: 'Subjektif', order: 1, aliases: ['  '] }]).ok,
    ).toBe(false);
  });
});
