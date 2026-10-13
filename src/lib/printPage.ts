/**
 * Print a whole HTML document (13.12): the browser's print dialog, where
 * "Save as PDF" / "Simpan sebagai PDF" makes one PDF file. A hidden frame,
 * so the app stays as it is; the frame goes once printing is done.
 */
export function printDocument(html: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    frame.remove();
    throw new Error('Tidak bisa membuka halaman cetak.');
  }
  doc.open();
  doc.write(html);
  doc.close();
  const cleanup = (): void => {
    window.setTimeout(() => frame.remove(), 1000);
  };
  win.addEventListener('afterprint', cleanup, { once: true });
  // Let the frame lay out (fonts, tables) before the dialog takes its picture.
  window.setTimeout(() => {
    win.focus();
    win.print();
    // Browsers that never fire afterprint (some phones): removed later anyway.
    window.setTimeout(() => frame.remove(), 60_000);
  }, 300);
}
