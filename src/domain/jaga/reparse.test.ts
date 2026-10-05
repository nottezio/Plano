import { describe, expect, it } from 'vitest';

import type { PdfTextItem } from '@/lib/pdfItems';
import { parseJagaRoster } from './parseRoster';
import { PARSER_VERSION, compactItems, expandItems, isLegacy, provenance, upgradeParsed } from './reparse';
import type { DpjpRoster } from './types';

const at = (x: number, y: number, text: string): PdfTextItem => ({ x, y, text, page: 1 });

/* The October DPJP geometry (names anonymised): row 6 is drawn as `6` + `Oktober 2026`. */
const DPJP_ITEMS = [
  at(87, 721, 'JADWAL JAGA DPJP UTAMA DAN PRIMARY PCI INSTALASI PUSAT JANTUNG TERPADU'),
  at(184, 673, 'JADWAL DPJP UTAMA'),
  at(396, 673, 'JADWAL PRIMARY PCI'),
  at(51, 648, '4 Oktober 2026'),
  at(168, 648, 'dr. Satu'),
  at(371, 648, 'dr. Dua'),
  at(49, 584, '6'),
  at(59, 584, 'Oktober 2026'),
  at(163, 584, 'dr. Tiga'),
  at(369, 584, 'dr. Empat'),
];

/** What the old parser stored: day 6 missing, no version, no source. */
const OLD_PARSE: DpjpRoster = {
  title: 'JADWAL JAGA DPJP UTAMA DAN PRIMARY PCI INSTALASI PUSAT JANTUNG TERPADU',
  days: [{ date: '2026-10-04', utama: 'dr. Satu', tindakan: 'dr. Dua' }],
  importedAt: '2026-10-01T08:00:00.000Z',
  source: { fileName: 'dpjp.pdf', documentDate: '2026-10-01T06:02:11.000Z' },
};

describe('upgradeParsed', () => {
  it('re-reads a schedule an older parser read, from its kept source', () => {
    const stored = { ...OLD_PARSE, sourceItems: compactItems(DPJP_ITEMS) };
    const { value, changed } = upgradeParsed('dpjp', stored);
    expect(changed).toBe(true);
    const upgraded = value as DpjpRoster;
    expect(upgraded.days.map((day) => day.date)).toEqual(['2026-10-04', '2026-10-06']);
    expect(upgraded.parser).toBe(PARSER_VERSION.dpjp);
    // What parsing did not produce is carried over untouched.
    expect(upgraded.importedAt).toBe(OLD_PARSE.importedAt);
    expect(upgraded.source).toEqual(OLD_PARSE.source);
    // A second pass is a no-op.
    expect(upgradeParsed('dpjp', upgraded).changed).toBe(false);
  });

  it('leaves a current-version schedule alone', () => {
    const fresh = { ...OLD_PARSE, ...provenance('dpjp', DPJP_ITEMS) };
    expect(upgradeParsed('dpjp', fresh)).toEqual({ value: fresh, changed: false });
  });

  it('cannot re-read a schedule imported before sources were kept, and says so', () => {
    expect(upgradeParsed('dpjp', OLD_PARSE).changed).toBe(false);
    expect(isLegacy('dpjp', OLD_PARSE)).toBe(true);
    expect(isLegacy('dpjp', { ...OLD_PARSE, ...provenance('dpjp', DPJP_ITEMS) })).toBe(false);
    // A kind whose parser never changed is not "legacy" for lacking a source.
    expect(isLegacy('jarkom', { entries: [], importedAt: '' })).toBe(false);
  });

  it('never replaces a working schedule with an empty re-parse', () => {
    const stored = { ...OLD_PARSE, sourceItems: compactItems([at(10, 10, 'tidak ada tabel')]) };
    expect(upgradeParsed('dpjp', stored)).toEqual({ value: stored, changed: false });
  });

  it('round-trips items through storage', () => {
    expect(expandItems(compactItems(DPJP_ITEMS))).toEqual(DPJP_ITEMS);
  });
});

describe('INT on the resident roster', () => {
  it('keeps an internal-medicine resident on the post, normalised', () => {
    const roster = parseJagaRoster([
      at(86, 781, 'Jadwal Jaga PPDS Kardiologi 1 Oktober - 15 November 2026'),
      at(65, 754, '3'),
      at(80, 754, 'Sabtu Malam'),
      at(108, 754, 'AA'),
      at(220, 754, 'BB'),
      at(237, 754, 'INT 1'),
    ]);
    expect(roster.shifts[0]?.posts.bangsalB).toBe('INT 1');
    expect(roster.shifts[0]?.posts.bangsalA).toBe('BB');
  });
});
