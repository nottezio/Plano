import { groupRows, type PdfRow, type PdfTextItem } from '@/lib/pdfItems';

import type { InitialsIndex, JagaPostId, JagaRoster, JagaShift } from './types';

/**
 * Where each column sits on the page, in PDF points.
 *
 * Measured from the 16 Aug – 30 Sep 2026 roster and matched by NEAREST centre
 * rather than by range, so a column that shifts a few points between months
 * still lands correctly. A fragment is assigned to whichever of these it is
 * closest to; nothing is ever dropped for being between two.
 *
 * `pedi` is here and is expected to be empty. Paediatrics keeps its own roster
 * that only they see, so the column exists in the header and is blank in every
 * row — the Formasi prints the post with nothing after it rather than dropping
 * a line, because a missing line reads as an oversight and a blank one reads
 * as "not ours".
 */
const COLUMNS: ReadonlyArray<readonly [JagaPostId | 'tanggal' | 'hari', number]> = [
  ['tanggal', 54],
  ['hari', 78],
  ['chiefPjt', 104],
  ['chiefKonsul', 121],
  ['chiefNonPjt', 137],
  ['igdA', 152],
  ['igdB', 166],
  ['cvcu', 181],
  ['rsws', 198],
  ['bangsalA', 219],
  ['bangsalB', 238],
  ['pedi', 259],
];

/** The shift table ends and the legend tables begin around here. */
const LEGEND_X = 285;

const MONTHS = [
  'januari',
  'februari',
  'maret',
  'april',
  'mei',
  'juni',
  'juli',
  'agustus',
  'september',
  'oktober',
  'november',
  'desember',
];

function columnOf(x: number): string {
  return COLUMNS.reduce((best, column) =>
    Math.abs(column[1] - x) < Math.abs(best[1] - x) ? column : best,
  )[0];
}

/**
 * The month and year the roster starts in, read from its title.
 *
 * The table prints day numbers only, and a roster spanning two months (16
 * Agustus – 30 September) has two runs of them. Without the title there is no
 * way to know which month day 3 belongs to, and the wrong answer is a Formasi
 * sent to last month's team.
 */
function startOfPeriod(title: string): { month: number; year: number } | null {
  const lower = title.toLowerCase();
  const month = MONTHS.findIndex((name) => lower.includes(name));
  const year = /\b(20\d{2})\b/.exec(title);
  if (month === -1 || !year) return null;
  return { month, year: Number(year[1]) };
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const WEEKDAYS = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

/** `Sabtu Malam` → 6, `Jum'at` → 5; -1 when the cell names no weekday. */
function weekdayOfHari(hari: string): number {
  const word = (hari.trim().split(/\s+/)[0] ?? '').toLowerCase().replace(/[^a-z]/g, '');
  return WEEKDAYS.indexOf(word);
}

function weekdayOfIso(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function addDaysIso(date: string, days: number): string {
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/**
 * Initial → full name, from the three legend tables down the right side.
 *
 * Read structurally rather than by column position, because there are three of
 * them (chief jaga, RSWS/bangsal/IGD, PCC-UH/CVCU) at different x offsets and
 * they do not start at the same height. What they share is a shape: a person's
 * name, then a two- or three-letter uppercase initial immediately to its
 * right. That pairing is what is matched.
 */
export function parseInitials(rows: readonly PdfRow[]): InitialsIndex {
  const index: InitialsIndex = {};
  for (const row of rows) {
    const items = row.items.filter((item) => item.x >= LEGEND_X);
    for (let position = 0; position < items.length; position += 1) {
      const name = items[position];
      const initial = items[position + 1];
      if (!name || !initial) continue;
      if (!/^[A-Z]{2,3}$/.test(initial.text)) continue;
      // A name, not a heading or a number: mixed case and long enough that
      // "No." and "Stase" cannot qualify.
      if (!/[a-z]/.test(name.text)) continue;
      if (name.text.replace(/[^a-zA-Z]/g, '').length <= 5) continue;
      // First wins. The same initial appearing twice is a roster error, and
      // overwriting would silently take the later one.
      if (!index[initial.text]) index[initial.text] = name.text;
    }
  }
  return index;
}

export function parseJagaRoster(items: readonly PdfTextItem[]): JagaRoster {
  const rows = groupRows(items);

  const title =
    rows
      .flatMap((row) => row.items.map((item) => item.text))
      .find((text) => /jadwal jaga/i.test(text)) ?? '';

  const period = startOfPeriod(title);
  const shifts: JagaShift[] = [];

  let month = period?.month ?? new Date().getMonth();
  let year = period?.year ?? new Date().getFullYear();
  let previousDay = 0;
  let lastDate: string | null = null;

  for (const row of rows) {
    const record: Record<string, string> = {};
    for (const item of row.items) {
      if (item.x >= LEGEND_X) continue;
      const key = columnOf(item.x);
      record[key] = record[key] ? `${record[key]} ${item.text}` : item.text;
    }

    const hari = record['hari'];
    if (!hari) continue;
    if (/^hari$/i.test(hari) || /jadwal jaga/i.test(hari)) continue;

    /*
      THE HARI COLUMN DECIDES THE DATE; a day number only confirms it
      (2026-10-05).

      A weekend's date is ONE merged cell printed between its two rows, and
      pdf.js attaches it to whichever row its baseline is nearer. Mostly that
      is the first row of the pair. On the October sheet, at the month
      boundary, it was not: `1` (Minggu) landed on the `Sabtu Malam` row and
      `2` (Senin) on `Minggu Malam`, so the 31 October night team was filed
      under 1 November, and 31 Oktober Sabtu Malam could not be confirmed at
      all.

      Every row names its weekday, and that cannot be misplaced. So a number
      is accepted only when the date it gives falls on the row's weekday;
      otherwise the date is walked from the previous row — the same date if
      the weekday did not change (Pagi → Malam), else forward to the next
      day with that weekday.
    */
    const weekday = weekdayOfHari(hari);
    const dayNumber = Number(record['tanggal']);
    let numbered: string | null = null;
    if (Number.isFinite(dayNumber) && dayNumber > 0) {
      // The roster spans a month boundary and prints day numbers only. A day
      // number smaller than the last one is the rollover.
      let candidateMonth = month;
      let candidateYear = year;
      if (dayNumber < previousDay) {
        candidateMonth += 1;
        if (candidateMonth > 11) {
          candidateMonth = 0;
          candidateYear += 1;
        }
      }
      numbered = iso(candidateYear, candidateMonth, dayNumber);
    }

    let date: string | null = null;
    if (numbered && (weekday === -1 || weekdayOfIso(numbered) === weekday)) {
      date = numbered;
    } else if (lastDate && weekday !== -1) {
      date = addDaysIso(lastDate, (weekday - weekdayOfIso(lastDate) + 7) % 7);
    } else if (numbered && !lastDate) {
      // The first row, with a weekday that disagrees: nothing to walk from.
      date = numbered;
    }

    if (date) {
      lastDate = date;
      previousDay = Number(date.slice(8, 10));
      month = Number(date.slice(5, 7)) - 1;
      year = Number(date.slice(0, 4));
    }

    if (!lastDate) continue;

    const shift: JagaShift['shift'] = /malam/i.test(hari)
      ? 'malam'
      : /pagi/i.test(hari)
        ? 'pagi'
        : 'penuh';

    const posts: JagaShift['posts'] = {};
    for (const [key] of COLUMNS) {
      if (key === 'tanggal' || key === 'hari') continue;
      const value = record[key];
      // `INT 3` and similar are intern markers in the Pedi column, not a
      // resident's initials. Left out rather than printed as a name.
      if (value && /^[A-Z]{2,3}$/.test(value)) posts[key] = value;
    }

    if (Object.keys(posts).length === 0) continue;
    shifts.push({ date: lastDate, shift, hari, posts });
  }

  return {
    title,
    shifts,
    initials: parseInitials(rows),
    importedAt: new Date().toISOString(),
  };
}
