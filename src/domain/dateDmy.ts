/**
 * Dates as Indonesians write them: tgl/bln/tahun.
 *
 * Why this exists: a native `<input type="date">` displays in the BROWSER's
 * locale, not the page's. On a phone set to English (US) it shows
 * "10/09/2026" for 9 Oktober — month first — and nothing in the page can
 * change that (`lang="id"` is ignored for it). `DateField` shows these
 * strings instead and keeps the native input only for its calendar.
 */

/** `2026-10-09` → `09/10/2026`; anything else → ''. */
export function formatDmy(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

/**
 * What a person types → ISO, or null.
 *
 * Day first, always. Accepts `/`, `-`, `.` or spaces between the parts, one-
 * or two-digit day and month, and a two-digit year (20xx). Rejects dates that
 * do not exist (31/02).
 */
export function parseDmy(text: string): string | null {
  const match = /^\s*(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})\s*[/.\-\s]\s*(\d{2}|\d{4})\s*$/.exec(text);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (match[3]!.length === 2) year += 2000;
  if (month < 1 || month > 12 || day < 1) return null;
  const at = new Date(Date.UTC(year, month - 1, day));
  if (at.getUTCMonth() !== month - 1 || at.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
