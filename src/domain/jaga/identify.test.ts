import { describe, expect, it } from 'vitest';

import { describeMismatch, identifyJagaPdf } from './identify';
import type { PdfTextItem } from '@/lib/pdfItems';

const items = (...texts: string[]): PdfTextItem[] =>
  texts.map((text, index) => ({ text, x: 0, y: 100 - index, page: 1 }));

describe('identifyJagaPdf', () => {
  it('recognises the resident roster by its column header', () => {
    expect(identifyJagaPdf(items('TANGGAL', 'HARI', 'CHIEF PJT', 'IGD A'))).toBe('roster');
  });

  it('recognises the DPJP roster even though it also says "jadwal jaga"', () => {
    // The DPJP document is titled "JADWAL JAGA DPJP UTAMA DAN PRIMARY PCI", so
    // testing for "jadwal jaga" first would read every DPJP file as a resident
    // roster — and produce zero shifts with no explanation.
    expect(
      identifyJagaPdf(items('JADWAL JAGA DPJP UTAMA DAN PRIMARY PCI', 'JADWAL PRIMARY PCI')),
    ).toBe('dpjp');
  });

  it('recognises the Jarkom sheet', () => {
    expect(identifyJagaPdf(items('NAMA', 'AGAMA', 'NAMA PANGGILAN', 'PJ JARKOM'))).toBe('jarkom');
  });

  it('returns null for something unrelated rather than guessing', () => {
    expect(identifyJagaPdf(items('Hasil Laboratorium', 'Hemoglobin', '14.2'))).toBeNull();
  });
});

describe('describeMismatch', () => {
  it('names both what was expected and what the file appears to be', () => {
    // "File salah" alone leaves the user to work out which of three it was —
    // the same lookup this feature exists to remove.
    const message = describeMismatch('roster', 'dpjp');
    expect(message).toContain('Jadwal DPJP');
    expect(message).toContain('Jadwal Jaga PPDS');
  });

  it('says so plainly when the file is none of the three', () => {
    expect(describeMismatch('jarkom', null)).toContain('tidak dikenali');
  });
});
