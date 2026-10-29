/**
 * Sending one patient to a colleague (handover).
 *
 * The patient document itself carries the request (`transferTo`,
 * `transferFrom`): patients are top-level with `ownerId`/`memberIds`
 * (SPEC 6.1), so accepting is a change of owner, not a copy. Notes, versions
 * and checklists move with it because they live under the same document.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The address to send to, lowercased as the rules compare it, or an error
 * message in Bahasa Indonesia.
 */
export function transferTarget(
  raw: string,
  myEmail: string | null | undefined,
): { email: string } | { error: string } {
  const email = raw.trim().toLowerCase();
  if (!email) return { error: 'Isi email Google rekan.' };
  if (!EMAIL.test(email)) return { error: 'Format email tidak valid.' };
  if (myEmail && email === myEmail.trim().toLowerCase()) {
    return { error: 'Itu email Anda sendiri.' };
  }
  return { email };
}
