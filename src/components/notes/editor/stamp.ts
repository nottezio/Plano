/**
 * The date (and time) the Catatan toolbar inserts (19 Oct 2026). Day first,
 * as every date in Plano: "19/10/2026", "19/10/2026 09.41".
 */
export function stampText(at: Date, withTime: boolean): string {
  const two = (n: number): string => String(n).padStart(2, '0');
  const date = `${two(at.getDate())}/${two(at.getMonth() + 1)}/${at.getFullYear()}`;
  return withTime ? `${date} ${two(at.getHours())}.${two(at.getMinutes())}` : date;
}
