/**
 * How the List Maker prints (2026-10-16, Avi: "view and change the printed
 * PDF and Word for the list and denah — the orientation, the font size").
 *
 * The same settings drive the PDF (printHtml) and the Word files (docx), and
 * the preview in the print setup. Kept per device: the printer is the
 * device's, and two members preparing the same list on two laptops need not
 * agree on a font size.
 *
 * `residentsNewPage` (2026-10-16, Avi): the residents' tables used to start
 * on a page of their own. When the denah and the DPJP boxes run past page 1,
 * that left most of page 2 empty and pushed the residents to page 3. Off by
 * default now: they follow the DPJP boxes.
 */

export interface ListPrint {
  landscape: boolean;
  /** Newspaper columns, 1–4. */
  columns: number;
  /** Text size in points. */
  fontPt: number;
}

export interface DenahPrint {
  landscape: boolean;
  fontPt: number;
  /** Start the residents' tables on a new page. */
  residentsNewPage: boolean;
  /** Residen as one column (the screen's "Daftar"), not three boxes a row (20 Oct 2026). */
  residentsList: boolean;
}

export interface PrintSettings {
  list: ListPrint;
  denah: DenahPrint;
}

/** The layouts as they were before settings existed, residents page aside. */
export const DEFAULT_PRINT: PrintSettings = {
  list: { landscape: true, columns: 4, fontPt: 6.5 },
  denah: { landscape: false, fontPt: 7.5, residentsNewPage: false, residentsList: false },
};

export const FONT_MIN = 5;
export const FONT_MAX = 12;

/** Half-point steps, within range; anything else falls back. */
export function fontPt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(n * 2) / 2));
}

export function readPrintSettings(raw: string | null): PrintSettings {
  try {
    const data = JSON.parse(raw ?? 'null') as { list?: Partial<ListPrint>; denah?: Partial<DenahPrint> } | null;
    const list = data?.list ?? {};
    const denah = data?.denah ?? {};
    const columns = Math.round(Number(list.columns));
    return {
      list: {
        landscape: typeof list.landscape === 'boolean' ? list.landscape : DEFAULT_PRINT.list.landscape,
        columns: columns >= 1 && columns <= 4 ? columns : DEFAULT_PRINT.list.columns,
        fontPt: fontPt(list.fontPt, DEFAULT_PRINT.list.fontPt),
      },
      denah: {
        landscape: typeof denah.landscape === 'boolean' ? denah.landscape : DEFAULT_PRINT.denah.landscape,
        fontPt: fontPt(denah.fontPt, DEFAULT_PRINT.denah.fontPt),
        residentsNewPage: typeof denah.residentsNewPage === 'boolean' ? denah.residentsNewPage : DEFAULT_PRINT.denah.residentsNewPage,
        residentsList: denah.residentsList === true,
      },
    };
  } catch {
    return DEFAULT_PRINT;
  }
}

/** Word sizes are half-points. */
export const halfPoints = (pt: number): number => Math.round(pt * 2);

/** A4 in millimetres, and the margins each printout uses. */
export const A4_MM = { short: 210, long: 297 } as const;
export const DENAH_MARGIN_MM = 10;
export const LIST_MARGIN_MM = 8;
export const LIST_GAP_MM = 6;

/** The printable box of a page, in mm. */
export function contentBox(landscape: boolean, marginMm: number): { width: number; height: number } {
  const width = (landscape ? A4_MM.long : A4_MM.short) - 2 * marginMm;
  const height = (landscape ? A4_MM.short : A4_MM.long) - 2 * marginMm;
  return { width, height };
}

/**
 * Where pages start, for the preview: blocks laid out top to bottom (tops and
 * bottoms in the same unit as `pageHeight`), each kept whole as a printed
 * table row is, a forced break where asked. Returns each page's top.
 *
 * A block taller than a page starts a page and runs over (as the browser
 * does with a row that cannot fit anywhere).
 */
export function pageStarts(blocks: ReadonlyArray<{ top: number; bottom: number; breakBefore?: boolean }>, pageHeight: number): number[] {
  const starts = [0];
  for (const block of blocks) {
    const start = starts[starts.length - 1]!;
    if (block.breakBefore && block.top > start) {
      starts.push(block.top);
      continue;
    }
    if (block.bottom - start > pageHeight && block.top > start) starts.push(block.top);
    // Still too tall from its own top: the overflow starts further pages.
    let last = starts[starts.length - 1]!;
    while (block.bottom - last > pageHeight && block.top <= last) {
      last += pageHeight;
      starts.push(last);
    }
  }
  return starts;
}
