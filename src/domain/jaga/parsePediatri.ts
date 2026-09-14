import { groupRows, type PdfTextItem } from '@/lib/pdfItems';

import type { PediatriRoster, PediatriShift } from './types';

const MONTHS: Record<string, number> = {
  januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
  juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
};

/**
 * The paediatrics roster, which is a different document from the other three.
 *
 * Three columns — `18 Agustus` · `(Kifli) - Dira` · `Jaga 2 Orang (Minggu)` —
 * with the month spelled out in each date cell and the year in neither. Pages
 * are per month and titled `Jadwal Jaga September`, so the year comes from the
 * caller: this sheet simply does not carry one, and inventing the current year
 * would silently mis-date every import made in January for December.
 *
 * WHAT THE BRACKETS MEAN (confirmed 13 September)
 *
 * A bracketed name is a **PPDS BTKV**, not cardiology. They are on with the
 * cardiology resident and the list must still print them — `Raden (BTKV)/ Ken`
 * — but the confirmation goes to the cardiology resident only, because that is
 * who the message asks about.
 *
 * HOW SHIFTS ARE READ
 *
 * A comma separates SHIFTS, not people. `Rizki, Ken` is Rizki on pagi and Ken
 * on malam; `(Kifli) - Galih, Dira` is Galih with Kifli on pagi, Dira on
 * malam. One name means one person covering the day — including Saturdays,
 * where paediatrics still counts as dinas and the sheet prints a single name
 * rather than the pagi/malam pair the cardiology roster uses.
 */
export function parsePediatri(items: readonly PdfTextItem[], year: number): PediatriRoster {
  const rows = groupRows(items, 2.5);
  const shifts: PediatriShift[] = [];
  let title = '';

  for (const row of rows) {
    const text = row.items.map((item) => item.text).join(' ');
    if (/jadwal jaga/i.test(text) && row.items.length === 1) {
      title = text;
      continue;
    }

    const dateItem = row.items.find((item) => /^\d{1,2}\s+[A-Za-z]+$/.test(item.text));
    if (!dateItem) continue;

    const [dayText, monthText] = dateItem.text.split(/\s+/);
    const month = MONTHS[(monthText ?? '').toLowerCase()];
    const day = Number(dayText);
    if (month === undefined || !Number.isFinite(day)) continue;

    // The names cell is whichever item sits to the right of the date and is
    // not the keterangan column. Matched by position rather than by index: the
    // two pages put their columns at different x, and a row with no keterangan
    // has two items where another has three.
    const names = row.items
      .filter((item) => item.x > dateItem.x + 20 && item.x < dateItem.x + 200)
      .map((item) => item.text)
      .join(' ')
      .trim();
    if (!names) continue;

    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const parts = names.split(',').map((part) => part.trim()).filter(Boolean);

    for (const [index, part] of parts.entries()) {
      // `(Kifli) - Dira`, `(Raden)Auri`, `(Kifli) – Dira` — bracket, optional
      // dash of either kind, then the cardiology name.
      const bracket = /\(([^)]+)\)\s*[-–—]?\s*(.*)$/.exec(part);
      const btkv = bracket ? (bracket[1] ?? '').trim() : '';
      const name = (bracket ? (bracket[2] ?? '') : part).trim();
      if (!name) continue;

      shifts.push({
        date,
        // One part covers the whole day; two are pagi then malam, in the order
        // they are written.
        shift: parts.length > 1 ? (index === 0 ? 'pagi' : 'malam') : 'penuh',
        name,
        ...(btkv ? { btkv } : {}),
      });
    }
  }

  return { title, shifts, importedAt: new Date().toISOString() };
}

/**
 * The entry covering a given date and shift.
 *
 * A `penuh` entry answers for both halves of the day: the sheet printing one
 * name means that person is on all of it, and asking for the "pagi" of a
 * single-name Saturday must not come back empty.
 */
export function pediatriFor(
  roster: PediatriRoster | null,
  date: string,
  shift: 'penuh' | 'pagi' | 'malam',
): PediatriShift | null {
  if (!roster) return null;
  const onDate = roster.shifts.filter((entry) => entry.date === date);
  return (
    onDate.find((entry) => entry.shift === shift) ??
    onDate.find((entry) => entry.shift === 'penuh') ??
    (shift === 'penuh' ? (onDate[0] ?? null) : null)
  );
}
