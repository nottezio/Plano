/**
 * Rewrite markup only the old contentEditable editor produced into shapes the
 * TipTap schema reads (added 18 Oct 2026). String-level and pure, so it runs
 * the same on load and on a remote replacement, and is testable without a DOM.
 *
 *  - `<li><input type=checkbox [checked]>&nbsp;text` (the oldest checklist
 *    rows) → `<li data-checked="true|false">text`;
 *  - `<font color=… size=…>` (execCommand foreColor / fontSize) →
 *    `<span style="color: …; font-size: …em">`.
 */

/** execCommand `fontSize` 1–7 as the browser drew them, relative to the note. */
const FONT_SIZE_EM: Record<string, string> = {
  '1': '0.75em',
  '2': '0.875em',
  '3': '1em',
  '4': '1.125em',
  '5': '1.5em',
  '6': '2em',
  '7': '3em',
};

function attr(attrs: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs);
  if (!match) return null;
  return match[2] ?? match[3] ?? match[4] ?? '';
}

export function prepareLegacyHtml(html: string): string {
  return html
    .replace(
      /<li([^>]*)>\s*<input([^>]*)>(?:&nbsp;| | )?/gi,
      (_whole, liAttrs: string, inputAttrs: string) => {
        if (!/type\s*=\s*"?checkbox/i.test(inputAttrs)) return _whole;
        const checked = /\schecked\b/i.test(` ${inputAttrs}`);
        const rest = liAttrs.replace(/\sdata-checked\s*=\s*("[^"]*"|'[^']*'|\S+)/i, '');
        return `<li${rest} data-checked="${String(checked)}">`;
      },
    )
    .replace(/<font\b([^>]*)>/gi, (_whole, attrs: string) => {
      const styles: string[] = [];
      const color = attr(attrs, 'color');
      if (color) styles.push(`color: ${color}`);
      const size = attr(attrs, 'size');
      const em = size ? FONT_SIZE_EM[size.trim()] : undefined;
      if (em) styles.push(`font-size: ${em}`);
      return styles.length > 0 ? `<span style="${styles.join('; ')}">` : '<span>';
    })
    .replace(/<\/font>/gi, '</span>');
}
