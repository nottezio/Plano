/**
 * A short public handle (`@dr.rina`) so a colleague can be found by a name
 * they chose, without a directory of every account (see `domain/transfer`).
 *
 * Lowercase letters, digits, dot and underscore; 3 to 20 characters; starts
 * and ends with a letter or digit. Mirrored by the `usernames` rule in
 * firestore.rules, checked by a test.
 */
export const USERNAME_PATTERN = '^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$';

const PATTERN = new RegExp(USERNAME_PATTERN);

/** The handle as stored (no '@', lowercased), or an error in Bahasa Indonesia. */
export function parseUsername(raw: string): { handle: string } | { error: string } {
  const handle = raw.trim().replace(/^@/, '').toLowerCase();
  if (!handle) return { error: 'Isi username.' };
  if (handle.length < 3) return { error: 'Minimal 3 karakter.' };
  if (handle.length > 20) return { error: 'Maksimal 20 karakter.' };
  if (!PATTERN.test(handle)) {
    return { error: 'Hanya huruf kecil, angka, titik dan garis bawah; awal dan akhir huruf atau angka.' };
  }
  return { handle };
}
