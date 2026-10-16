import { contentBox, DENAH_MARGIN_MM, LIST_GAP_MM, LIST_MARGIN_MM, pageStarts, type PrintSettings } from '@/domain/floorList/printSettings';

/**
 * Cut the preview document (`previewHtml`) into A4 pages, in place
 * (2026-10-16). The browser lays the content out once at the page's text
 * width; this measures it and shows it page by page, as print would:
 *
 * - denah: table rows are kept whole (they are `break-inside: avoid` in
 *   print) and the residents may start a page; each page shows its slice of
 *   the one laid-out sheet;
 * - list: one box a page tall whose columns run on to the right; page k shows
 *   columns k·n … k·n+n−1.
 *
 * Returns the number of pages and the laid-out height (px, unscaled).
 */
export const MM = 96 / 25.4;

function frame(doc: Document, landscape: boolean, marginMm: number, viewportHeight: number): { page: HTMLElement; viewport: HTMLElement } {
  const page = doc.createElement('div');
  const w = (landscape ? 297 : 210) * MM;
  const h = (landscape ? 210 : 297) * MM;
  page.style.cssText = `width:${w}px;height:${h}px;padding:${marginMm * MM}px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.35);margin:0 auto 16px;overflow:hidden;position:relative;`;
  const viewport = doc.createElement('div');
  viewport.style.cssText = `height:${viewportHeight}px;overflow:hidden;position:relative;`;
  page.append(viewport);
  return { page, viewport };
}

function label(doc: Document, page: HTMLElement, n: number, of: number): void {
  const tag = doc.createElement('div');
  tag.textContent = `${n}/${of}`;
  tag.style.cssText = 'position:absolute;right:6px;bottom:4px;font:10px Arial;color:#888;';
  page.append(tag);
}

export function paginate(doc: Document, kind: 'denah' | 'list', settings: PrintSettings): { pages: number; height: number } {
  const body = doc.body;
  const host = doc.createElement('div');
  if (kind === 'list') {
    const list = doc.querySelector<HTMLElement>('.list');
    if (!list) return { pages: 0, height: 0 };
    const box = contentBox(settings.list.landscape, LIST_MARGIN_MM);
    const step = (box.width + LIST_GAP_MM) * MM;
    const pages = Math.max(1, Math.ceil((list.scrollWidth + LIST_GAP_MM * MM - 1) / step));
    for (let k = 0; k < pages; k += 1) {
      const { page, viewport } = frame(doc, settings.list.landscape, LIST_MARGIN_MM, box.height * MM);
      const copy = list.cloneNode(true) as HTMLElement;
      copy.style.marginLeft = `${-k * step}px`;
      viewport.append(copy);
      label(doc, page, k + 1, pages);
      host.append(page);
    }
    list.remove();
  } else {
    const sheet = doc.querySelector<HTMLElement>('.sheet');
    if (!sheet) return { pages: 0, height: 0 };
    const box = contentBox(settings.denah.landscape, DENAH_MARGIN_MM);
    const origin = sheet.getBoundingClientRect().top;
    const blocks: Array<{ top: number; bottom: number; breakBefore?: boolean }> = [];
    const add = (el: Element, breakBefore = false): void => {
      // By tag, not `instanceof`: the element belongs to the iframe's window,
      // whose HTMLTableElement is not this window's.
      if (el.tagName === 'TABLE') {
        /*
          Rows tied by a cell spanning several rows (the nurse station, 411)
          are kept together, as print does: the group is one block. Found
          against Chromium's own PDF, which broke a page earlier than a
          row-by-row preview.
        */
        const rows = [...(el as HTMLTableElement).rows];
        let i = 0;
        let first = true;
        while (i < rows.length) {
          let end = i;
          for (let r = i; r <= end; r += 1) {
            for (const cell of [...rows[r]!.cells]) end = Math.max(end, Math.min(rows.length - 1, r + cell.rowSpan - 1));
          }
          const top = rows[i]!.getBoundingClientRect().top - origin;
          const bottom = rows[end]!.getBoundingClientRect().bottom - origin;
          blocks.push({ top, bottom, ...(breakBefore && first ? { breakBefore: true } : {}) });
          first = false;
          i = end + 1;
        }
        return;
      }
      const rect = el.getBoundingClientRect();
      if (rect.height === 0 && !breakBefore) return;
      blocks.push({ top: rect.top - origin, bottom: rect.bottom - origin, ...(breakBefore ? { breakBefore } : {}) });
    };
    for (const child of [...sheet.children]) {
      if (child.hasAttribute('data-residents')) {
        [...child.children].forEach((inner, i) => add(inner, i === 0 && settings.denah.residentsNewPage));
      } else add(child);
    }
    const height = sheet.scrollHeight;
    const starts = pageStarts(blocks, box.height * MM);
    starts.forEach((start, i) => {
      const end = Math.min(starts[i + 1] ?? height, start + box.height * MM);
      const { page, viewport } = frame(doc, settings.denah.landscape, DENAH_MARGIN_MM, end - start);
      const copy = sheet.cloneNode(true) as HTMLElement;
      copy.style.marginTop = `${-start}px`;
      viewport.append(copy);
      label(doc, page, i + 1, starts.length);
      host.append(page);
    });
    sheet.remove();
  }
  host.style.cssText = 'padding:12px 0;';
  body.append(host);
  return { pages: host.children.length, height: host.scrollHeight + 24 };
}
