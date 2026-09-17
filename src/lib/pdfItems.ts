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

/**
 * A PDF date (`D:20260901103000+07'00'`) as an ISO string, or null.
 *
 * Written here rather than using pdf.js's helper, so it can be tested without
 * loading the PDF engine. Only the date and time digits are read; the zone is
 * applied when present, and a string without one is taken as UTC. The value
 * is used only to order two versions of a document, so the exact zone of a
 * producer that omits it does not matter.
 */
export function parsePdfDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const match =
    /^(?:D:)?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?(?:([Zz+-])(\d{2})?'?(\d{2})?'?)?/.exec(
      raw.trim(),
    );
  if (!match) return null;
  const [, y, mo = '01', d = '01', h = '00', mi = '00', se = '00', sign, zh = '00', zm = '00'] = match;
  const base = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se));
  if (Number.isNaN(base)) return null;
  const offset = sign === '+' || sign === '-' ? (Number(zh) * 60 + Number(zm)) * 60_000 : 0;
  const utc = sign === '+' ? base - offset : sign === '-' ? base + offset : base;
  return new Date(utc).toISOString();
}

export interface PdfSource {
  fileName: string;
  /**
   * When the DOCUMENT was last produced: its modification date, else its
   * creation date. Not the file's date on disk, which is when it was
   * downloaded from WhatsApp and says nothing about which version it is.
   */
  documentDate: string | null;
}

export async function extractPdfItems(file: File): Promise<PdfTextItem[]> {
  return (await extractPdf(file)).items;
}

export async function extractPdf(
  file: File,
): Promise<{ items: PdfTextItem[]; source: PdfSource }> {
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

  let documentDate: string | null = null;
  try {
    const meta = await document.getMetadata();
    const info = (meta.info ?? {}) as { ModDate?: unknown; CreationDate?: unknown };
    documentDate = parsePdfDate(info.ModDate) ?? parsePdfDate(info.CreationDate);
  } catch {
    // No readable metadata: the document date is simply unknown.
  }

  await document.cleanup();
  return { items, source: { fileName: file.name, documentDate } };
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
