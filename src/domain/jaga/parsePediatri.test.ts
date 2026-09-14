import { describe, expect, it } from 'vitest';

import { parsePediatri, pediatriFor } from './parsePediatri';
import type { PdfTextItem } from '@/lib/pdfItems';

/** One roster row: date at x=78, names at x=155, keterangan at x=285. */
const row = (y: number, date: string, names: string, note?: string): PdfTextItem[] => [
  { x: 78, y, text: date, page: 1 },
  { x: 155, y, text: names, page: 1 },
  ...(note ? [{ x: 285, y, text: note, page: 1 }] : []),
];

const SHEET: PdfTextItem[] = [
  { x: 72, y: 706, text: 'Jadwal Jaga Agustus', page: 1 },
  ...row(671, 'Tanggal', 'PPDS Jaga', 'Keterangan'),
  ...row(646, '16 Agustus', 'Fatur, Galih', 'Jaga 2 Orang (Minggu)'),
  ...row(597, '18 Agustus', 'Auri'),
  ...row(572, '19 Agustus', '(Kifli)- Dira'),
  ...row(423, '25 Agustus', '(Kifli) - Galih, Dira', 'Hari Libur Nasional (2 Orang)'),
  ...row(299, '30 Agustus', 'Fatur, (Kifli) - Suci', 'Jaga 2 Orang (Minggu)'),
  ...row(275, '31 Agustus', '(Raden) – Rizki'),
];

const ROSTER = parsePediatri(SHEET, 2026);

describe('parsePediatri', () => {
  it('reads a single name as covering the whole day', () => {
    // Including Saturdays: paediatrics still counts as dinas, so the sheet
    // prints one name where the cardiology roster splits the day.
    expect(ROSTER.shifts.filter((s) => s.date === '2026-08-18')).toEqual([
      { date: '2026-08-18', shift: 'penuh', name: 'Auri' },
    ]);
  });

  it('reads a comma as a SHIFT break, not a second person on the same shift', () => {
    const day = ROSTER.shifts.filter((s) => s.date === '2026-08-16');
    expect(day).toMatchObject([
      { shift: 'pagi', name: 'Fatur' },
      { shift: 'malam', name: 'Galih' },
    ]);
  });

  it('reads a bracketed name as the BTKV resident, not the cardiology one', () => {
    // Confirmed 13 September: the brackets are PPDS BTKV. Taking the bracketed
    // name as the person on call would send the confirmation to somebody who
    // cannot answer for a cardiology post.
    expect(ROSTER.shifts.find((s) => s.date === '2026-08-19')).toMatchObject({
      name: 'Dira',
      btkv: 'Kifli',
    });
  });

  it('attaches the BTKV name to the shift it is written on', () => {
    // `Fatur, (Kifli) - Suci` — Kifli is on the malam half, not the pagi one.
    const day = ROSTER.shifts.filter((s) => s.date === '2026-08-30');
    expect(day[0]).toMatchObject({ shift: 'pagi', name: 'Fatur' });
    expect(day[1]).toMatchObject({ shift: 'malam', name: 'Suci', btkv: 'Kifli' });
  });

  it('handles both dash characters the sheet uses', () => {
    expect(ROSTER.shifts.find((s) => s.date === '2026-08-31')).toMatchObject({
      name: 'Rizki',
      btkv: 'Raden',
    });
  });

  it('splits a bracketed two-shift day correctly', () => {
    const day = ROSTER.shifts.filter((s) => s.date === '2026-08-25');
    expect(day).toMatchObject([
      { shift: 'pagi', name: 'Galih', btkv: 'Kifli' },
      { shift: 'malam', name: 'Dira' },
    ]);
  });

  it('ignores the header row', () => {
    expect(ROSTER.shifts.some((s) => s.name === 'PPDS Jaga')).toBe(false);
  });
});

describe('pediatriFor', () => {
  it('answers both halves of a single-name day', () => {
    // Asking for the pagi of a one-name Saturday must not come back empty.
    expect(pediatriFor(ROSTER, '2026-08-18', 'pagi')?.name).toBe('Auri');
    expect(pediatriFor(ROSTER, '2026-08-18', 'malam')?.name).toBe('Auri');
  });

  it('picks the right half of a split day', () => {
    expect(pediatriFor(ROSTER, '2026-08-16', 'malam')?.name).toBe('Galih');
  });

  it('returns null for a date the sheet does not cover', () => {
    expect(pediatriFor(ROSTER, '2026-08-17', 'penuh')).toBeNull();
  });
});
