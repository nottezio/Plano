/**
 * SPEC F6 — copying must work on iOS Safari.
 *
 * `navigator.clipboard.writeText` is unavailable on older iOS, and on newer iOS
 * it rejects unless the call happens inside the same user gesture that
 * triggered it. Any `await` before the write breaks that chain — which is why
 * callers must have the text ready BEFORE the tap handler runs, and why the
 * fallback exists at all.
 *
 * The fallback uses a real (but visually hidden) textarea because iOS ignores
 * `execCommand('copy')` on an off-screen or `display: none` element, and
 * refuses to select a `readonly` input at all.
 */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    // Permission denied, non-secure context, or gesture chain broken. Fall
    // through rather than reporting failure — the legacy path often still works.
    console.warn('[clipboard] async write failed, trying fallback', error);
  }

  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.width = '1px';
  textarea.style.height = '1px';
  textarea.style.opacity = '0';
  // iOS zooms to any focused input under 16px; this avoids a visible jolt.
  textarea.style.fontSize = '16px';
  textarea.contentEditable = 'true';

  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.setSelectionRange(0, text.length);
    const range = document.createRange();
    range.selectNodeContents(textarea);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    textarea.setSelectionRange(0, text.length);

    return document.execCommand('copy');
  } catch (error) {
    console.error('[clipboard] fallback copy failed', error);
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
