/**
 * Hand a file the app made to the person, the way their device expects.
 *
 * On a phone (coarse pointer) with file sharing, the share sheet: from there
 * a .docx goes straight to Word, a printer app or WhatsApp, where a download
 * would leave it in a Files folder to be found again. On a laptop, a plain
 * download — the Windows share sheet is not where anyone looks for a file.
 *
 * The object URL is revoked after a delay, not at once: Safari and Firefox
 * start the download asynchronously, and revoking in the same tick can leave
 * an empty or failed file.
 */
export async function deliverFile(blob: Blob, fileName: string): Promise<void> {
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  if (coarse && typeof navigator.canShare === 'function' && typeof File === 'function') {
    const file = new File([blob], fileName, { type: blob.type });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (error) {
        // Closing the sheet is a choice, not a failure.
        if (error instanceof DOMException && error.name === 'AbortError') return;
        // Anything else (no user activation left, a refused type): download.
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
