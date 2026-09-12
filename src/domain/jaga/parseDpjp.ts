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
 * Three columns split on x. The thresholds are deliberately wide — the names
 * are centred in their cells, so a long one (`Prof. Dr. dr. Idar Mappangara,
 * Sp.PD, Sp.JP(K)`) starts nearly 30 points left of a short one in the same
 * column. Splitting at the midpoints between columns rather than at the
 * observed starts is what makes that survive.
 */
export function parseDpjpRoster(items: readonly PdfTextItem[]): DpjpRoster {
  const rows = groupRows(items, 3);
  const days: DpjpDay[] = [];

  const title =
    rows.flatMap((row) => row.items.map((item) => item.text)).find((text) => /jadwal jaga dpjp/i.test(text)) ??
    rows.flatMap((row) => row.items.map((item) => item.text)).find((text) => /^[A-Z]+\s+\d{4}$/.test(text)) ??
    '';

  for (const row of rows) {
    const dateItem = row.items.find((item) => item.x < 140 && parseIndonesianDate(item.text));
    if (!dateItem) continue;
    const date = parseIndonesianDate(dateItem.text);
    if (!date) continue;

    const utama = row.items.filter((item) => item.x >= 140 && item.x < 345).map((item) => item.text).join(' ');
    const tindakan = row.items.filter((item) => item.x >= 345).map((item) => item.text).join(' ');
    if (!utama && !tindakan) continue;

    days.push({ date, utama: utama.trim(), tindakan: tindakan.trim() });
  }

  return { title, days, importedAt: new Date().toISOString() };
}
