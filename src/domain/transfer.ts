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
 * People the sender can pick without typing an email: everyone they share a
 * List Maker list with, by the name that list shows. Not a directory of all
 * users, on purpose: these accounts already see each other's names.
 */
export function teammates(
  floors: ReadonlyArray<{ memberIds: readonly string[]; names: Readonly<Record<string, string>> }>,
  myUid: string,
): Array<{ uid: string; name: string }> {
  const byUid = new Map<string, string>();
  for (const floor of floors) {
    for (const uid of floor.memberIds) {
      const name = floor.names[uid]?.trim();
      if (uid !== myUid && name && !byUid.has(uid)) byUid.set(uid, name);
    }
  }
  return [...byUid]
    .map(([uid, name]) => ({ uid, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'id'));
}

/** An email (has an '@' after the first character); otherwise a username, '@' optional. */
export function isEmailInput(raw: string): boolean {
  return raw.trim().slice(1).includes('@');
}

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
