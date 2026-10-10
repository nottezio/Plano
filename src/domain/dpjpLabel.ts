/**
 * "DPJP" as the ward actually types it (2026-10-11).
 *
 * Every DPJP reader keyed on the exact letters "DPJP". A real note read
 * "_DJPJP Utama : dr. Zaenab …_": the Utama line was invisible, the next line
 * ("DPJP Aritmia : Prof. … Muzakkir Amir") became the primary DPJP, and the
 * patient was filed, formatted and reminded as the wrong consultant's.
 *
 * A typo'd label is a short word of only d, p and j that has both a p and a
 * j: DPJP, DJPJP, DPJ, DJPJ, DPPJ. No Indonesian or medical word is made of
 * those letters alone, so this cannot catch a real word. Boundaries are
 * spelled out because `_` is a word character and the lines are italic.
 */
const TYPO = /(?<![A-Za-z0-9])d[pj]{2,4}(?![A-Za-z0-9])/gi;

export function normaliseDpjpLabel(line: string): string {
  return line.replace(TYPO, (word) => (/p/i.test(word) && /j/i.test(word) ? 'DPJP' : word));
}
