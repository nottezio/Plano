import { groupRows, type PdfTextItem } from '@/lib/pdfItems';

import type { DpjpDay, DpjpRoster } from './types';

const MONTHS: Record<string, number> = {
  januari: 0, february: 1, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
  juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
};

/**
 * `1 September 2026` → `2026-09-01`.
 *
 * The date is spelled out in full in every row of this document, so unlike the
 * resident roster there is nothing to infer and no month boundary to guess at.
 */
function parseIndonesianDate(text: string): string | null {
  const match = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const month = MONTHS[(match[2] ?? '').toLowerCase()];
  if (month === undefined) return null;
  return `${match[3]}-${String(month + 1).padStart(2, '0')}-${String(Number(match[1])).padStart(2, '0')}`;
}

/**
 * The DPJP roster: date, DPJP Utama, Primary PCI.
 *
 * READ FROM THE DOCUMENT'S OWN LAYOUT (2026-10-05).
 *
 * This used to split columns at fixed x positions measured on the September
 * sheet (date < 140 ≤ utama < 345 ≤ PCI) and to expect each date as ONE text
 * fragment. The October sheet broke both, silently:
 *
 * - `5 Oktober 2026` … `8 Oktober 2026` are drawn as two fragments, `5` and
 *   `Oktober 2026`. No single fragment parsed as a date, so the four rows
 *   were skipped — the Formasi for 6 October had no DPJP at all.
 * - Names are centred in their cells, and `Prof. Dr. dr. Idar Mappangara, …`
 *   starts at x = 139, one point left of the hard-coded column. Its row kept
 *   the PCI name and lost the DPJP Utama (9 and 24 October).
 *
 * 27 of 31 days parsed, and nothing said so. So now:
 *
 * - The date is read from the row's leading fragments, joined — one, two or
 *   three of them, whichever first spells a date.
 * - The boundary between the two name columns is the midpoint between the
 *   document's own `JADWAL DPJP UTAMA` and `JADWAL PRIMARY PCI` headers, so it
 *   moves with the sheet. Centred names spread around their header, never
 *   past the midpoint to the next one.
 * - Without those headers (a sheet laid out differently), names are taken in
 *   order: the first is the DPJP Utama, the rest Primary PCI.
 */
export function parseDpjpRoster(items: readonly PdfTextItem[]): DpjpRoster {
  const rows = groupRows(items, 3);
  const days: DpjpDay[] = [];

  const texts = rows.flatMap((row) => row.items.map((item) => item.text));
  const title =
    texts.find((text) => /jadwal jaga dpjp/i.test(text)) ??
    texts.find((text) => /^[A-Z]+\s+\d{4}$/.test(text)) ??
    '';

  const headerX = (pattern: RegExp): number | null =>
    rows.flatMap((row) => row.items).find((item) => pattern.test(item.text))?.x ?? null;
  const utamaHeader = headerX(/dpjp utama/i);
  const pciHeader = headerX(/primary pci/i);
  const boundary =
    utamaHeader !== null && pciHeader !== null && pciHeader > utamaHeader
      ? (utamaHeader + pciHeader) / 2
      : null;

  for (const row of rows) {
    const ordered = [...row.items].sort((a, b) => a.x - b.x);

    let date: string | null = null;
    let used = 0;
    for (let count = 1; count <= Math.min(3, ordered.length); count += 1) {
      date = parseIndonesianDate(
        ordered
          .slice(0, count)
          .map((item) => item.text)
          .join(' '),
      );
      if (date) {
        used = count;
        break;
      }
    }
    if (!date) continue;

    const names = ordered.slice(used);
    const left = boundary === null ? names.slice(0, 1) : names.filter((item) => item.x < boundary);
    const right = boundary === null ? names.slice(1) : names.filter((item) => item.x >= boundary);
    const utama = left.map((item) => item.text).join(' ').trim();
    const tindakan = right.map((item) => item.text).join(' ').trim();
    if (!utama && !tindakan) continue;

    days.push({ date, utama, tindakan });
  }

  return { title, days, importedAt: new Date().toISOString() };
}
