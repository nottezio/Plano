import { describe, expect, it } from 'vitest';

import type { PdfTextItem } from '@/lib/pdfItems';
import { parseJagaRoster } from './parseRoster';

/*
  The month boundary of the 1 Oktober – 15 November 2026 sheet, with its
  geometry and anonymised initials. A weekend's date is one merged cell drawn
  between its two rows; here, as on the real sheet, `1` (Minggu) sits on the
  Sabtu Malam row and `2` (Senin) on the Minggu Malam row.
*/
const at = (x: number, y: number, text: string): PdfTextItem => ({ x, y, text, page: 1 });

const row = (y: number, hari: string, number?: string): PdfTextItem[] => [
  ...(number ? [at(65, y, number)] : []),
  at(80, y, hari),
  at(108, y, 'AA'),
  at(125, y, 'BB'),
  at(220, y, 'CC'),
];

const BOUNDARY = [
  at(86, 781, 'Jadwal Jaga PPDS Kardiologi 1 Oktober - 15 November 2026'),
  at(60, 771, 'TANGGAL'),
  at(84, 771, 'HARI'),
  ...row(700, 'Jumat', '30'),
  ...row(696, 'Sabtu Pagi', '31'),
  ...row(692, 'Sabtu Malam', '1'),
  ...row(688, 'Minggu Pagi'),
  ...row(684, 'Minggu Malam', '2'),
  ...row(680, 'Senin'),
  ...row(676, 'Selasa', '3'),
];

describe('parseJagaRoster', () => {
  const roster = parseJagaRoster(BOUNDARY);
  const dated = roster.shifts.map((shift) => `${shift.date} ${shift.hari}`);

  it('dates each row by its weekday, not by a day number pdf.js put on the wrong row', () => {
    expect(dated).toEqual([
      '2026-10-30 Jumat',
      '2026-10-31 Sabtu Pagi',
      '2026-10-31 Sabtu Malam',
      '2026-11-01 Minggu Pagi',
      '2026-11-01 Minggu Malam',
      '2026-11-02 Senin',
      '2026-11-03 Selasa',
    ]);
  });

  it('every shift falls on the weekday its row names', () => {
    const names = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
    for (const shift of roster.shifts) {
      const weekday = names[new Date(`${shift.date}T00:00:00Z`).getUTCDay()] ?? '';
      expect(shift.hari.toLowerCase().startsWith(weekday)).toBe(true);
    }
  });

  it('keeps the two weekend teams apart', () => {
    const saturday = roster.shifts.filter((shift) => shift.date === '2026-10-31');
    expect(saturday.map((shift) => shift.shift)).toEqual(['pagi', 'malam']);
  });

  it('a number on its own row is still used when it agrees with the weekday', () => {
    const plain = parseJagaRoster([
      at(86, 781, 'Jadwal Jaga PPDS Kardiologi 1 Oktober - 15 November 2026'),
      ...row(766, 'Kamis', '1'),
      ...row(762, 'Jumat', '2'),
    ]);
    expect(plain.shifts.map((shift) => shift.date)).toEqual(['2026-10-01', '2026-10-02']);
  });
});
