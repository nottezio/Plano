import { groupRows, type PdfTextItem } from '@/lib/pdfItems';

import type { JarkomDirectory, JarkomEntry } from './types';

/**
 * The Jarkom sheet: full name, agama, nama panggilan.
 *
 * Read by role rather than by column position. The sheet's fragments arrive in
 * an order that puts the PJ-Jarkom column FIRST on many rows, so keying on
 * "the second item" would take the wrong name on roughly half of them. What is
 * unambiguous is shape:
 *
 *   the name    — the only item beginning `dr.`
 *   the agama   — the only item that is exactly `Muslim` or `Non Muslim`
 *   the panggilan — the short name immediately right of the agama
 *
 * `Non Muslim` has to be tested before `Muslim`, since the second is a
 * substring of the first and the wrong order marks every non-Muslim resident
 * as Muslim — which would send them the wrong greeting, the one thing this
 * document exists to prevent.
 */
export function parseJarkom(items: readonly PdfTextItem[]): JarkomDirectory {
  const rows = groupRows(items, 2.5);
  const entries: JarkomEntry[] = [];

  for (const row of rows) {
    // `\s*`, not `\s`. One row in the July 2026 sheet reads `dr.Glory Audrey
    // Haurissa` with no space, and requiring one dropped her entirely — which
    // would have sent her the wrong greeting via the fallback.
    const name = row.items.find((item) => /^dr\.?\s*[A-Z]/i.test(item.text));
    const agama = row.items.find((item) => /^(non\s+muslim|muslim)$/i.test(item.text));
    if (!name || !agama) continue;

    const muslim = !/^non/i.test(agama.text);
    const panggilan = row.items
      .filter((item) => item.x > agama.x && /^[A-Za-z][A-Za-z' .-]*$/.test(item.text))
      .sort((a, b) => a.x - b.x)[0];

    entries.push({
      name: name.text.trim(),
      panggilan: (panggilan?.text ?? '').trim(),
      muslim,
    });

    /*
      THE SECOND TABLE, on the right of the same rows.

      The 2026 sheet carries a `list NIM Semnol` block beside the main one —
      `dr. Mevlana Muhammad Avicenna Pasiak | Avi | C165261003`. Those are the
      PJ-Jarkom seniors, and they are precisely the 14 names that had no row
      of their own and so fell back to the neutral greeting forever.

      Read here rather than in a separate pass because they share a row with
      the main table and the row grouping has already been done. There is no
      agama column on that side, so they arrive with `muslim: null` — which is
      honest, and correctable by hand on the confirmation row.
    */
    const second = row.items.find(
      (item) => item.x > (panggilan?.x ?? name.x) + 40 && /^dr\.?\s*[A-Z]/i.test(item.text),
    );
    if (!second) continue;
    const secondNick = row.items
      .filter((item) => item.x > second.x && /^[A-Za-z][A-Za-z' .-]{1,14}$/.test(item.text))
      .sort((a, b) => a.x - b.x)[0];
    if (!secondNick) continue;
    entries.push({
      name: second.text.trim(),
      panggilan: secondNick.text.trim(),
      muslim: null,
    });
  }

  return { entries, importedAt: new Date().toISOString() };
}
