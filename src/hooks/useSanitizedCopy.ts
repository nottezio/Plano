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

export function useSanitizedCopy(asciiOnly: boolean): void {
  useEffect(() => {
    function onCopy(event: ClipboardEvent): void {
      const selection = document.getSelection();
      const text = selection?.toString() ?? '';
      if (!text || !event.clipboardData) return;

      event.clipboardData.setData('text/plain', sanitizeCopiedText(text, asciiOnly));
      event.clipboardData.setData('text/html', '');
      event.preventDefault();
    }

    document.addEventListener('copy', onCopy);
    return () => document.removeEventListener('copy', onCopy);
  }, [asciiOnly]);
}
