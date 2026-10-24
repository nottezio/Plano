/**
 * A small window for writing beside another app (22 Oct 2026, Avi: "write
 * without covering SIMGOS in the browser").
 *
 * Chrome/Edge: Document Picture-in-Picture, a window that stays ON TOP of
 * every other window, which is the point. Elsewhere: an ordinary popup
 * (it can fall behind the other window, but still sits beside it).
 *
 * The page's stylesheets are copied in (as absolute URLs: the new document is
 * about:blank, so relative ones would not load) along with the theme
 * attributes on <html>, so the note looks as it does in the app.
 */
interface PipApi {
  requestWindow(options: { width: number; height: number }): Promise<Window>;
}

export async function openMiniWindow(title: string, width = 380, height = 520): Promise<Window | null> {
  const pip = (window as unknown as { documentPictureInPicture?: PipApi }).documentPictureInPicture;
  // PiP can refuse (no user activation, an embedded browser): fall back to a popup.
  const win =
    (pip ? await pip.requestWindow({ width, height }).catch(() => null) : null) ??
    window.open('', 'plano-mini', `popup,width=${width},height=${height}`);
  if (!win) return null;
  const doc = win.document;
  doc.title = title;
  for (const node of document.querySelectorAll('link[rel="stylesheet"], style')) {
    const copy = node.cloneNode(true) as HTMLElement;
    if (copy.tagName === 'LINK') (copy as HTMLLinkElement).href = (node as HTMLLinkElement).href;
    doc.head.appendChild(copy);
  }
  for (const attr of document.documentElement.attributes) doc.documentElement.setAttribute(attr.name, attr.value);
  doc.body.className = 'bg-bg text-fg';
  doc.body.style.margin = '0';
  return win;
}
