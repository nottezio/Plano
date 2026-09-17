import { useEffect } from 'react';

import { foldToAscii } from '@/domain/format/formatters';

/**
 * Sanitise text copied by SELECTING it, rather than through the Salin button.
 *
 * The button runs `toPlain` or `toWhatsApp`. Dragging across the note and
 * pressing Ctrl+C runs nothing, and the browser puts two flavours on the
 * clipboard:
 *
 *   text/html   the app's own markup, carrying the dark theme's `background`
 *               and `color`. SIMGOS is a rich-text editor and honours them, so
 *               a pasted assessment arrived as white text on a black block.
 *   text/plain  the body verbatim, including invisible characters and every
 *               non-ASCII glyph, which SIMGOS renders as `?`.
 *
 * Both reported problems are that one gap: a copy path with no formatter on
 * it. This puts one there.
 *
 * `text/html` is dropped entirely rather than cleaned. Nothing in this app is
 * worth pasting as styled markup — the destinations are WhatsApp and a
 * hospital text field — and an empty string is the only version of that markup
 * guaranteed not to carry a theme colour into someone else's editor.
 */
/**
 * The transform itself, separated from the event so it can be tested without
 * a DOM selection. Everything the sanitiser decides happens here.
 */
export function sanitizeCopiedText(text: string, asciiOnly: boolean): string {
  /**
   * Invisible characters go regardless of destination, matching the rule the
   * formatters already follow: they carry no meaning anywhere, and they were
   * the original source of stray `?` in SIMGOS.
   *
   * `\p{Zs}` — the non-ASCII SPACES — are included, because they are
   * non-ASCII and pixel-identical to a space, so they are unfindable by eye
   * and produce a `?` nobody can explain. Replaced with a space, never
   * removed: `Nadi 78` must not become `Nadi78`.
   */
  const cleaned = text
    .replace(/[\u00AD\u180E]/gu, '')
    .replace(/\p{Cf}/gu, '')
    .replace(/[\p{Zl}\p{Zp}]/gu, '\n')
    .replace(/\p{Zs}/gu, ' ');

  /**
   * ASCII folding is OPT-IN, because it is the one step that depends on where
   * the text is going. `°C` and `₂` are correct in WhatsApp and become `?` in
   * SIMGOS, so folding always would quietly degrade every WhatsApp copy to fix
   * a SIMGOS one. The caller knows which surface is on screen; this does not.
   */
  return asciiOnly ? foldToAscii(cleaned) : cleaned;
}

/**
 * Whether a copy is folded to ASCII, decided by WHERE the selection is.
 *
 * `data-copy-format` on an ancestor names the format on screen there:
 * `whatsapp` keeps `°` and `₂`, `plain` folds them. Without one, the app-wide
 * default applies.
 *
 * Per element rather than only the global `nonAsciiPreview` flag, because
 * several peek windows can be open at once, each in its own view. One boolean
 * set by each of them would be right for whichever window wrote last and
 * wrong for the rest.
 */
export function resolveAsciiOnly(
  declared: string | null | undefined,
  fallback: boolean,
): boolean {
  if (declared === 'plain') return true;
  if (declared === 'whatsapp') return false;
  return fallback;
}

/**
 * The selected text, including a selection INSIDE a textarea or input.
 *
 * `Selection.toString()` does not reliably report text selected inside a form
 * control; Firefox returns an empty string. The early return below then let
 * the browser copy the note editor's raw text, zero-width spaces and all,
 * untouched. The control's own selection range is the dependable source.
 */
function selectedText(): { text: string; origin: Element | null } {
  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
    const start = active.selectionStart ?? 0;
    const end = active.selectionEnd ?? 0;
    if (end > start) return { text: active.value.slice(start, end), origin: active };
  }
  const selection = document.getSelection();
  const anchor = selection?.anchorNode ?? null;
  return {
    text: selection?.toString() ?? '',
    origin: anchor instanceof Element ? anchor : (anchor?.parentElement ?? null),
  };
}

export function useSanitizedCopy(asciiOnly: boolean): void {
  useEffect(() => {
    function onCopy(event: ClipboardEvent): void {
      const { text, origin } = selectedText();
      if (!text || !event.clipboardData) return;

      const declared = origin?.closest('[data-copy-format]')?.getAttribute('data-copy-format');
      event.clipboardData.setData(
        'text/plain',
        sanitizeCopiedText(text, resolveAsciiOnly(declared, asciiOnly)),
      );
      event.clipboardData.setData('text/html', '');
      event.preventDefault();
    }

    document.addEventListener('copy', onCopy);
    return () => document.removeEventListener('copy', onCopy);
  }, [asciiOnly]);
}
