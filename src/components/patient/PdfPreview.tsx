import { useEffect, useRef } from 'react';
import { openPdf } from '@/lib/pdfText';

/**
 * Shows the dropped PDFs as they are printed, so the extracted values can be
 * checked against the source page. Rendered on the device like the text
 * extraction; nothing is uploaded.
 */
export function PdfPreview({ files }: { files: readonly File[] }): JSX.Element {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = host.current;
    if (!root) return;
    let cancelled = false;
    root.replaceChildren();

    void (async () => {
      const width = root.clientWidth || 480;
      const ratio = window.devicePixelRatio || 1;
      for (const file of files) {
        try {
          const doc = await openPdf(file);
          for (let n = 1; n <= doc.numPages; n += 1) {
            const page = await doc.getPage(n);
            if (cancelled) return;
            const base = page.getViewport({ scale: 1 });
            const viewport = page.getViewport({ scale: (width / base.width) * ratio });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = '100%';
            canvas.className = 'mb-2 block rounded border border-border bg-white';
            await page.render({ canvas, viewport }).promise;
            if (cancelled) return;
            root.appendChild(canvas);
          }
        } catch (error) {
          console.error('[lab] PDF preview failed', error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [files]);

  return (
    <div
      ref={host}
      className="h-[60vh] overflow-auto rounded-xl border border-border bg-bg-subtle p-2"
    />
  );
}
