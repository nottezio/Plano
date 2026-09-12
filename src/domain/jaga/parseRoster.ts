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

    const dayNumber = Number(record['tanggal']);
    if (Number.isFinite(dayNumber) && dayNumber > 0) {
      // The roster spans a month boundary and prints day numbers only. A day
      // number smaller than the last one is the rollover — the only signal
      // there is.
      if (dayNumber < previousDay) {
        month += 1;
        if (month > 11) {
          month = 0;
          year += 1;
        }
      }
      previousDay = dayNumber;
      lastDate = iso(year, month, dayNumber);
    }

    // A weekend `Malam` row has no date of its own: the TANGGAL cell is merged
    // across both shifts and pdf.js attaches it to the first. Inheriting the
    // last date is not a guess — the merged cell is literally the same cell.
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
