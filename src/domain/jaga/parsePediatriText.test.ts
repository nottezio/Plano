import { describe, expect, it } from 'vitest';

import { parsePediatriText } from './parsePediatriText';

// The shape of the WhatsApp message, with invented names.
const MESSAGE = `* Jumat, 09 Oktober: dr. Anto
* Minggu, 11 Oktober: dr. Bela & dr. Cici
* Kamis, 15 Oktober: dr. Dodi - dr. Bela
* Senin, 19 Oktober: dr.dodi - dr. Eka
* Minggu, 15 November: dr. Dodi - dr. Fajar & dr. Eka
Mohon dicek kembali ya`;

describe('parsePediatriText', () => {
  const { roster, skipped, weekdayMismatch } = parsePediatriText(MESSAGE, '2026-10-09');

  it('reads one name as the whole day, with the year from the weekday', () => {
    expect(roster.shifts.filter((s) => s.date === '2026-10-09')).toEqual([
      { date: '2026-10-09', shift: 'penuh', name: 'Anto' },
    ]);
    expect(skipped).toEqual([]);
    expect(weekdayMismatch).toEqual([]);
  });

  it('reads "&" as a shift break, like the comma on the PDF sheet', () => {
    expect(roster.shifts.filter((s) => s.date === '2026-10-11')).toEqual([
      { date: '2026-10-11', shift: 'pagi', name: 'Bela' },
      { date: '2026-10-11', shift: 'malam', name: 'Cici' },
    ]);
  });

  it('reads "A - B" as A the BTKV partner of B, like "(A) - B" on the sheet', () => {
    expect(roster.shifts.find((s) => s.date === '2026-10-15')).toEqual({
      date: '2026-10-15',
      shift: 'penuh',
      name: 'Bela',
      btkv: 'Dodi',
    });
    // No space after "dr." and a lower-case name.
    expect(roster.shifts.find((s) => s.date === '2026-10-19')).toMatchObject({ name: 'Eka', btkv: 'Dodi' });
  });

  it('keeps the BTKV partner on the shift it is written on', () => {
    expect(roster.shifts.filter((s) => s.date === '2026-11-15')).toEqual([
      { date: '2026-11-15', shift: 'pagi', name: 'Fajar', btkv: 'Dodi' },
      { date: '2026-11-15', shift: 'malam', name: 'Eka' },
    ]);
  });

  it('ignores chat lines that are not dates', () => {
    expect(roster.shifts.some((s) => /mohon/i.test(s.name))).toBe(false);
  });

  it('dates a January message seen in December into the next year', () => {
    const next = parsePediatriText('* Jumat, 01 Januari: dr. Anto', '2026-12-20');
    expect(next.roster.shifts[0]?.date).toBe('2027-01-01');
    expect(next.weekdayMismatch).toEqual([]);
  });

  it('reports a weekday that fits no nearby year instead of trusting it', () => {
    const wrong = parsePediatriText('* Senin, 09 Oktober: dr. Anto', '2026-10-09');
    expect(wrong.weekdayMismatch).toHaveLength(1);
    expect(wrong.roster.shifts[0]?.date).toBe('2026-10-09');
  });

  it('accepts the bracket form and an explicit year', () => {
    const sheet = parsePediatriText('16 Oktober 2026: (Dodi) - Anto', '2026-10-09');
    expect(sheet.roster.shifts[0]).toEqual({ date: '2026-10-16', shift: 'penuh', name: 'Anto', btkv: 'Dodi' });
  });

  it('lists a date line it could not read', () => {
    expect(parsePediatriText('* Jumat, 31 Februari: dr. Anto', '2026-10-09').skipped).toHaveLength(1);
  });
});
