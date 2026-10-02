import { describe, expect, it } from 'vitest';

import { composeCopy, composeDocument, composeSection } from './composeCopy';
import { composeInvasif } from './composeInvasif';
import { composeKonsul } from './composeKonsul';
import { composePdfReport } from './pdfReport';
import { composeShiftNote } from './composeShiftNote';
import { findConvertibleSymbols, toPlain, toWhatsApp } from './formatters';
import { DEFAULT_SECTION_ALIASES as ALIASES } from '../defaults';
import { makePatient } from '../testFactories';

/**
 * The invariant behind the `?` in SIMGOS: whatever produced it, PLAIN output is
 * ASCII — from every composer, not just the ones somebody remembered.
 *
 * Konsul and Grup invasif passed a zero-width space and an NBSP straight
 * through, because they were the two composers that never called
 * `formatBody`. Each composer is listed here by name, so a new one that is
 * not added to this list is the only way to escape the check.
 */
const ZWSP = '\u200B';
const PATIENT = makePatient({ name: 'Tn. Uji', mrn: '1234567', age: 60, ward: 'PJT Lt. 4', bed: '3' });

// Every character class that has reached a note in the real corpus.
const HOSTILE = [
  `${ZWSP}Assalamualaikum prof. Tabe prof, mohon izin melaporkan follow up pasien di *PJT Lantai 4* atas nama :`,
  '',
  '*Tn. Uji/01-01-1966/60 tahun/RM 1234567*',
  '',
  '_DPJP Utama dan Tindakan : Prof. X\u00A0SpJP(K)_',
  '',
  '*S :*',
  `${ZWSP}- Nyeri dada \u2060berkurang`,
  '',
  '*O :*',
  'Suhu 36,5\u00B0C \u2013 SpO2 98%\u2026',
  '',
  '*Mohon izin kami assess dengan*',
  `${ZWSP}- CAD 2VD\u00A0post PTCA \u2022 \u201Cstabil\u201D`,
  '',
  '*Mohon izin kami terapi dengan*',
  `- Aspilet 80 mg\u202F/24 jam`,
  '',
  'Laporan PTCA di PJT (16-09-2026)',
  `${ZWSP}- CAD 2 VD\uFEFF`,
  '',
  'TB : 160 cm',
  'BB : 60 kg',
].join('\n');

const nonAscii = (text: string): string[] =>
  [...text].filter((char) => char.charCodeAt(0) > 127).map(
    (char) => `U+${char.codePointAt(0)?.toString(16).toUpperCase()}`,
  );

const PLAIN_OUTPUTS: Record<string, () => string> = {
  toPlain: () => toPlain(HOSTILE),
  composeCopy: () =>
    composeCopy([{ date: '2026-09-16', body: HOSTILE }], {
      format: 'plain',
      sections: 'all',
      includeIdentity: true,
      includeDateHeader: true,
      aliases: ALIASES,
      patient: PATIENT,
    }),
  composeSection: () => composeSection(HOSTILE, 'a', 'plain', ALIASES),
  composeDocument: () => composeDocument(HOSTILE, 'all', 'plain', ALIASES),
  composePdfReport: () => composePdfReport(HOSTILE, { aliases: ALIASES, format: 'plain' }),
  composeShiftNote: () =>
    composeShiftNote({ id: 'j1', time: '20.00', body: HOSTILE, done: false } as never, PATIENT, {
      format: 'plain',
      bullet: 'hyphen',
      includeIdentity: true,
    }),
  composeKonsul: () => composeKonsul(HOSTILE, PATIENT, ALIASES, { purpose: '6MWT', format: 'plain' }),
  composeKonsulList: () =>
    composeKonsul(HOSTILE, PATIENT, ALIASES, {
      purpose: 'Echo',
      listStyle: true,
      listFrom: 'PJT',
      listDate: '16-09-2026',
      format: 'plain',
    }),
  composeInvasif: () =>
    composeInvasif(HOSTILE, PATIENT, ALIASES, {
      procedure: 'PCI',
      includeInvestigations: true,
      format: 'plain',
    }),
};

describe('plain output is ASCII from every composer', () => {
  for (const [name, produce] of Object.entries(PLAIN_OUTPUTS)) {
    it(name, () => {
      expect(nonAscii(produce())).toEqual([]);
    });
  }
});

describe('invisible characters never reach WhatsApp output either', () => {
  it('konsul', () => {
    const out = composeKonsul(HOSTILE, PATIENT, ALIASES, { purpose: '6MWT' });
    expect(out).not.toMatch(/[\u200B\u2060\uFEFF]/);
  });

  it('invasif', () => {
    const out = composeInvasif(HOSTILE, PATIENT, ALIASES, {
      procedure: 'PCI',
      includeInvestigations: true,
    });
    expect(out).not.toMatch(/[\u200B\u2060\uFEFF]/);
  });

  it('peek WhatsApp view (default bullets)', () => {
    expect(toWhatsApp(HOSTILE)).not.toMatch(/[\u200B\u2060\uFEFF]/);
  });
});

describe('symbols in Teks polos', () => {
  it('spells known symbols instead of deleting them (default on)', () => {
    expect(toPlain('Troponin ↑, K 3,1↓')).toBe('Troponin (naik), K 3,1 (turun)');
    expect(toPlain('Aspilet → CPG')).toBe('Aspilet -> CPG');
    expect(toPlain('β-blocker, α-agonis, Δ ST')).toBe('beta-blocker, alpha-agonis, delta ST');
    expect(toPlain('NTG 10 µg/menit, µmol')).toBe('NTG 10 mcg/menit, umol');
    expect(toPlain('MAP 65 ± 5, EKG ✓')).toBe('MAP 65 +/- 5, EKG (v)');
  });

  it('deletes them when switched off, and stays ASCII either way', () => {
    const text = 'Troponin ↑ → ICCU β';
    expect(toPlain(text, { asciiSymbols: false })).toBe('Troponin   ICCU ');
    expect(nonAscii(toPlain(text, { asciiSymbols: false }))).toEqual([]);
    expect(nonAscii(toPlain(text))).toEqual([]);
  });

  it('never turns a fraction or a power into a different number', () => {
    // Before: `½ tab` → `12 tab`, `1½` → `112`, `10³/µL` → `103/uL`.
    expect(toPlain('Bisoprolol ½ tab')).toBe('Bisoprolol 1/2 tab');
    expect(toPlain('1½ tab')).toBe('1 1/2 tab');
    expect(toPlain('PLT 250 10³/µL', { asciiSymbols: false })).toBe('PLT 250 10^3/L');
    expect(toPlain('PLT 250 10³/µL')).toBe('PLT 250 10^3/uL');
    expect(toPlain('BSA 1,8 m², 10⁻³')).toBe('BSA 1,8 m^2, 10^-3');
    expect(toPlain('⅐ dosis')).toBe('1/7 dosis');
  });

  it('reaches every composer through its options', () => {
    const body = '*S :*\n- Nyeri dada ↓';
    const on = composeCopy([{ date: '2026-09-16', body }], {
      format: 'plain', sections: 'all', includeIdentity: false, includeDateHeader: false,
      aliases: ALIASES, patient: PATIENT,
    });
    const off = composeCopy([{ date: '2026-09-16', body }], {
      format: 'plain', sections: 'all', includeIdentity: false, includeDateHeader: false,
      aliases: ALIASES, patient: PATIENT, asciiSymbols: false,
    });
    expect(on).toContain('Nyeri dada (turun)');
    expect(off).not.toContain('(turun)');
  });

  it('lists what it converts, with counts, in order', () => {
    expect(findConvertibleSymbols('a → b ↑ c →')).toEqual([
      { symbol: '→', ascii: '->', count: 2 },
      { symbol: '↑', ascii: '(naik)', count: 1 },
    ]);
  });
});
