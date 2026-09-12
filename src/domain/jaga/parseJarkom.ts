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
  }

  return { entries, importedAt: new Date().toISOString() };
}
