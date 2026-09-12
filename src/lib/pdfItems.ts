/**
 * PDF text WITH POSITIONS.
 *
 * `extractPdfText` in `pdfText.ts` reads a PDF as prose, which is right for a
 * lab report and useless for a roster. These documents are tables, and pdf.js
 * emits their fragments in draw order — so read as text, the jaga roster comes
 * out with the shift table interleaved with the legend beside it, and no
 * amount of cleverness afterwards can tell which column a two-letter initial
 * came from.
 *
 * The x/y of each fragment is the missing information, and with it the tables
 * reconstruct exactly. That is the whole reason PDF import is possible here at
 * all; without it these files would have to be retyped.
 */

interface PositionedItem {
  str?: string;
  transform?: number[];
}

export interface PdfTextItem {
  /** Distance from the left edge, in PDF points. */
  x: number;
  /** Distance from the BOTTOM edge — larger is higher up the page. */
  y: number;
  text: string;
  page: number;
}

export async function extractPdfItems(file: File): Promise<PdfTextItem[]> {
  // Loaded on demand: the PDF engine is around a megabyte and most sessions
  // never import a roster.
  const pdfjs = await import('pdfjs-dist');

  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const buffer = await file.arrayBuffer();
  const document = await pdfjs.getDocument({ data: buffer }).promise;

  const items: PdfTextItem[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    for (const raw of content.items as PositionedItem[]) {
      const text = (raw.str ?? '').trim();
      const transform = raw.transform;
      if (!text || !transform) continue;
      items.push({ x: transform[4] ?? 0, y: transform[5] ?? 0, text, page: pageNumber });
    }
  }

  await document.cleanup();
  return items;
}

export interface PdfRow {
  y: number;
  page: number;
  items: PdfTextItem[];
}

/**
 * Group fragments into table rows by their vertical position.
 *
 * `tolerance` is in points and matters more than it looks. The jaga roster
 * puts two shifts four points apart on a weekend — `Minggu Pagi` and `Minggu
 * Malam` are different teams entirely — so a generous tolerance silently
 * merges two rosters into one row of pairs. Two points keeps them apart.
 *
 * The row's anchor `y` is the FIRST fragment's, never a running average: an
 * average drifts as fragments are added, so a row can creep far enough to
 * swallow the next one. That is precisely how the two weekend shifts merged in
 * the first version of this.
 */
export function groupRows(items: readonly PdfTextItem[], tolerance = 2): PdfRow[] {
  const rows: PdfRow[] = [];
  for (const item of [...items].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x)) {
    const row = rows.find(
      (candidate) => candidate.page === item.page && Math.abs(candidate.y - item.y) <= tolerance,
    );
    if (row) row.items.push(item);
    else rows.push({ y: item.y, page: item.page, items: [item] });
  }
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  return rows.sort((a, b) => a.page - b.page || b.y - a.y);
}
