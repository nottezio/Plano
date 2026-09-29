/**
 * Everything this app keeps in browser storage that belongs to the PERSON
 * signed in, cleared as one set at sign-out.
 *
 * Sign-out used to remove two things by name (the census history and the
 * offline cache). Everything else stayed for the next person on the device:
 * the PIN (so "Lupa PIN? Keluar" signed you out straight back into the same
 * lock, forever), the Anthropic key and AI consent flags (a colleague's AI
 * calls billed to you, on your consent), the clipboard note (your patient's
 * name and RM under their account), board layouts, stickers and the jaga
 * roster. Each new store had to remember to add its own line to sign-out,
 * and most did not.
 *
 * So it is inverted: every `visite.*` / `plano.*` key is cleared EXCEPT the
 * few that describe the DEVICE rather than the person. A new key is cleared
 * by default, which is the safe default.
 */
const DEVICE_KEYS = new Set([
  'visite.deviceId',
  'visite.theme',
  'visite.iosInstallHint.dismissed',
  'visite.chunkRecovery',
]);

function isOurs(key: string): boolean {
  return key.startsWith('visite.') || key.startsWith('plano.');
}

function clearIn(storage: Storage): void {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && isOurs(key) && !DEVICE_KEYS.has(key)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}

export function clearDeviceUserState(): void {
  try {
    clearIn(localStorage);
  } catch {
    // No storage: nothing was kept.
  }
  try {
    clearIn(sessionStorage);
  } catch {
    // Same.
  }
}

/** Set when sign-out could not delete the offline cache; read at next boot. */
export const CACHE_KEPT_FLAG = 'plano.signout.cacheKept';
