import type { PediatriRoster, PediatriShift } from './types';

/**
 * The paediatrics roster as it is actually passed around: a WhatsApp message.
 *
 *   * Jumat, 09 Oktober: dr. A
 *   * Minggu, 11 Oktober: dr. B & dr. C
 *   * Kamis, 15 Oktober: dr. D - dr. B
 *   * Minggu, 15 November: dr. D - dr. E & dr. F
 *
 * Same meaning as the PDF sheet (`parsePediatri`), different punctuation:
 *
 *   PDF                     WhatsApp            meaning
 *   `Fatur, Galih`          `B & C`             two SHIFTS: pagi B, malam C
 *   `(Kifli) - Dira`        `D - B`             D is the PPDS BTKV with B
 *   `(Kifli) - Galih, Dira` `D - E & F`         pagi E (with BTKV D), malam F
 *
 * The bracket form is accepted too, in case someone copies the sheet's text.
 *
 * NO YEAR. The message names the weekday, so the year is the one, nearest to
 * the date being viewed, in which that date falls on that weekday. A weekday
 * that matches no nearby year is reported rather than silently trusted.
 */

const MONTHS: Record<string, number> = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, agu: 8, agt: 8, agus: 8,
  sep: 9, sept: 9, okt: 10, nov: 11, des: 12,
};

const WEEKDAYS: Record<string, number> = {
  minggu: 0, ahad: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, "jum'at": 5, sabtu: 6,
};

export interface PediatriTextResult {
  roster: PediatriRoster;
  /** Lines that looked like a date line but could not be read. */
  skipped: string[];
  /** Dates whose weekday matched no nearby year: dated anyway, but say so. */
  weekdayMismatch: string[];
}

function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function validDay(year: number, month: number, day: number): boolean {
  const at = new Date(Date.UTC(year, month - 1, day));
  return at.getUTCMonth() === month - 1 && at.getUTCDate() === day;
}

function pickYear(month: number, day: number, weekday: number | null, viewed: string): { year: number; ok: boolean } {
  const [vy, vm] = viewed.split('-').map(Number);
  const baseYear = vy || new Date().getFullYear();
  const baseMonth = vm || 1;
  const distance = (year: number): number => Math.abs(year * 12 + month - (baseYear * 12 + baseMonth));
  const candidates = [baseYear - 1, baseYear, baseYear + 1].sort((a, b) => distance(a) - distance(b));
  if (weekday === null) return { year: candidates[0] ?? baseYear, ok: true };
  const matching = candidates.find((year) => validDay(year, month, day) && weekdayOf(year, month, day) === weekday);
  return matching === undefined ? { year: candidates[0] ?? baseYear, ok: false } : { year: matching, ok: true };
}

/** "dr. razak" → "Razak"; "dr.Aurea" → "Aurea". */
function cleanName(raw: string): string {
  const name = raw
    .replace(/\bdr\.?\s*/gi, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
}

/** One shift's text → the cardiology name and, when written, the BTKV partner. */
function readPart(part: string): { name: string; btkv: string } {
  const bracket = /\(([^)]+)\)\s*[-–—]?\s*(.*)$/.exec(part);
  if (bracket) return { btkv: cleanName(bracket[1] ?? ''), name: cleanName(bracket[2] ?? '') };
  const dash = /^(.+?)\s+[-–—]\s+(.+)$/.exec(part) ?? /^(.+?)[-–—]\s*(dr\.?.+)$/i.exec(part);
  if (dash) return { btkv: cleanName(dash[1] ?? ''), name: cleanName(dash[2] ?? '') };
  return { btkv: '', name: cleanName(part) };
}

const LINE =
  /^(?:([A-Za-z']+)\s*,?\s+)?(\d{1,2})\s+([A-Za-z]+)\.?(?:\s+(\d{4}))?\s*:\s*(.+)$/;

export function parsePediatriText(text: string, viewed: string): PediatriTextResult {
  const shifts: PediatriShift[] = [];
  const skipped: string[] = [];
  const weekdayMismatch: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    // Bullets and WhatsApp emphasis: "* ", "• ", "- ", "*Jumat*, …".
    const line = rawLine.replace(/^[\s*•·>\-–]+/, '').replace(/\*/g, '').trim();
    if (!line) continue;
    const match = LINE.exec(line);
    if (!match) {
      // Only complain about lines that look like they were meant to be dates.
      if (/\d{1,2}\s+[A-Za-z]{3,}/.test(line) && line.includes(':')) skipped.push(rawLine.trim());
      continue;
    }
    const [, weekdayText, dayText, monthText, yearText, namesText] = match;
    const month = MONTHS[(monthText ?? '').toLowerCase()];
    const day = Number(dayText);
    const weekday = weekdayText ? WEEKDAYS[weekdayText.toLowerCase()] : undefined;
    if (!month || !day || (weekdayText && weekday === undefined)) {
      skipped.push(rawLine.trim());
      continue;
    }

    let year: number;
    if (yearText) {
      year = Number(yearText);
    } else {
      const picked = pickYear(month, day, weekday ?? null, viewed);
      year = picked.year;
      if (!picked.ok) weekdayMismatch.push(rawLine.trim());
    }
    if (!validDay(year, month, day)) {
      skipped.push(rawLine.trim());
      continue;
    }
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // `&`, a comma or "dan" separate SHIFTS (pagi, then malam), as the
    // comma does on the PDF sheet.
    const parts = (namesText ?? '')
      .split(/\s*(?:&|,|\bdan\b)\s*/i)
      .map((part) => part.trim())
      .filter(Boolean);
    const read = parts.map(readPart).filter((part) => part.name);
    if (read.length === 0) {
      skipped.push(rawLine.trim());
      continue;
    }
    for (const [index, part] of read.entries()) {
      shifts.push({
        date,
        shift: read.length > 1 ? (index === 0 ? 'pagi' : 'malam') : 'penuh',
        name: part.name,
        ...(part.btkv ? { btkv: part.btkv } : {}),
      });
    }
  }

  shifts.sort((a, b) => a.date.localeCompare(b.date));
  return {
    roster: { title: 'Jadwal Jaga Pediatri (teks WhatsApp)', shifts, importedAt: new Date().toISOString() },
    skipped,
    weekdayMismatch,
  };
}
