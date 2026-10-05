import { describe, expect, it } from 'vitest';

import type { PdfTextItem } from '@/lib/pdfItems';
import { parseDpjpRoster } from './parseDpjp';

/*
  Geometry copied from the October 2026 sheet, names anonymised. The two
  traps it reproduces are the ones that cost four days and two DPJP Utama:
  a date drawn as two fragments (`5` + `Oktober 2026`), and a long centred
  name starting at x = 139, left of where the old parser's column began.
*/
const at = (x: number, y: number, text: string): PdfTextItem => ({ x, y, text, page: 1 });

const HEADER = [
  at(87, 721, 'JADWAL JAGA DPJP UTAMA DAN PRIMARY PCI INSTALASI PUSAT JANTUNG TERPADU'),
  at(59, 673, 'TANGGAL'),
  at(184, 673, 'JADWAL DPJP UTAMA'),
  at(396, 673, 'JADWAL PRIMARY PCI'),
];

const OCTOBER = [
  ...HEADER,
  // One fragment, as on 1–4 October.
  at(51, 648, '4 Oktober 2026'),
  at(168, 648, 'dr. Konsulen Satu, Sp.PD-KKV'),
  at(371, 648, 'Dr. dr. Konsulen Dua, Sp.JP(K)'),
  // Two fragments, as on 5–8 October.
  at(49, 584, '6'),
  at(59, 584, 'Oktober 2026'),
  at(163, 584, 'dr. Konsulen Tiga, Sp.PD, Sp.JP(K)'),
  at(369, 584, 'Dr.dr. Konsulen Empat, Sp.JP(K)'),
  // A long centred name starting at 139.
  at(51, 545, '9 Oktober 2026'),
  at(139, 545, 'Prof. Dr. dr. Konsulen Lima Panjang Sekali, Sp.PD, Sp.JP(K)'),
  at(351, 545, 'Prof. Dr. dr. Konsulen Lima Panjang Sekali, Sp.PD, Sp.JP(K)'),
];

describe('parseDpjpRoster', () => {
  const roster = parseDpjpRoster(OCTOBER);
  const byDate = Object.fromEntries(roster.days.map((day) => [day.date, day]));

  it('reads a date drawn as one fragment', () => {
    expect(byDate['2026-10-04']).toEqual({
      date: '2026-10-04',
      utama: 'dr. Konsulen Satu, Sp.PD-KKV',
      tindakan: 'Dr. dr. Konsulen Dua, Sp.JP(K)',
    });
  });

  it('reads a date drawn as two fragments (5–8 October were lost)', () => {
    expect(byDate['2026-10-06']).toEqual({
      date: '2026-10-06',
      utama: 'dr. Konsulen Tiga, Sp.PD, Sp.JP(K)',
      tindakan: 'Dr.dr. Konsulen Empat, Sp.JP(K)',
    });
  });

  it('keeps a centred name that starts left of where the column header does', () => {
    expect(byDate['2026-10-09']?.utama).toBe('Prof. Dr. dr. Konsulen Lima Panjang Sekali, Sp.PD, Sp.JP(K)');
    expect(byDate['2026-10-09']?.tindakan).toBe(
      'Prof. Dr. dr. Konsulen Lima Panjang Sekali, Sp.PD, Sp.JP(K)',
    );
  });

  it('places the column boundary from the headers, so a shifted sheet still reads', () => {
    const shifted = OCTOBER.map((item) => ({ ...item, x: item.x + 60 }));
    expect(parseDpjpRoster(shifted).days).toEqual(roster.days);
  });

  it('without headers, takes names in order: DPJP Utama first', () => {
    const bare = OCTOBER.filter((item) => !HEADER.includes(item));
    const day = parseDpjpRoster(bare).days.find((entry) => entry.date === '2026-10-06');
    expect(day?.utama).toBe('dr. Konsulen Tiga, Sp.PD, Sp.JP(K)');
    expect(day?.tindakan).toBe('Dr.dr. Konsulen Empat, Sp.JP(K)');
  });

  it('keeps the title', () => {
    expect(roster.title).toMatch(/jadwal jaga dpjp/i);
  });
});
