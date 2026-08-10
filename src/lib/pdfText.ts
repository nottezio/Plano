/**
 * Reading a lab PDF.
 *
 * A lab PDF from SIMGOS carries a real text layer, so there is nothing to
 * recognise: the numbers are already characters and can be read exactly. That
 * makes this strictly better than OCR on a screenshot of the same report — not
 * more accurate, but *exact*, which for a potassium value is the only standard
 * worth having.
 *
 * Everything happens in the browser. The file is read from disk, parsed in
 * memory, and discarded when the sheet closes. Nothing is uploaded, nothing is
 * written to Firestore, and no image or PDF ever leaves the device.
 */

interface TextItem {
  str: string;
  transform: number[];
}

/**
 * Rows are reconstructed from glyph positions, because a PDF has no lines.
 *
 * `getTextContent` returns positioned fragments in draw order, which for a
 * table is column by column, not row by row — concatenating them naively gives
 * every analyte name followed by every result. Grouping by baseline puts each
 * table row back together, which is what the parser expects.
 */
const BASELINE_TOLERANCE = 3;

function toLines(items: readonly TextItem[]): string[] {
  const rows = new Map<number, Array<{ x: number; text: string }>>();

  for (const item of items) {
    if (!item.str.trim()) continue;

    const x = item.transform[4] ?? 0;
    const y = item.transform[5] ?? 0;

    // Snap to a shared key so fragments a fraction of a point apart — which is
    // normal within one row — land in the same bucket.
    const key = Math.round(y / BASELINE_TOLERANCE) * BASELINE_TOLERANCE;
    const row = rows.get(key);
    if (row) row.push({ x, text: item.str });
    else rows.set(key, [{ x, text: item.str }]);
  }

  return (
    [...rows.entries()]
      // Descending y: PDF coordinates start at the bottom of the page.
      .sort((a, b) => b[0] - a[0])
      .map(([, row]) =>
        row
          .sort((a, b) => a.x - b.x)
          .map((cell) => cell.text.trim())
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim(),
      )
      .filter(Boolean)
  );
}

export async function extractPdfText(file: File): Promise<string> {
  // Loaded on demand: the PDF engine is around a megabyte and most sessions
  // never open a lab report.
  const pdfjs = await import('pdfjs-dist');

  // The worker ships with the library; pointing at it by URL keeps Vite's
  // bundling and the worker's own module resolution in agreement.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const buffer = await file.arrayBuffer();
  const document = await pdfjs.getDocument({ data: buffer }).promise;

  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(toLines(content.items as TextItem[]).join('\n'));
  }

  await document.cleanup();
  return pages.join('\n');
}

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}
