/**
 * "Someone was signed in on this device": a hint, not a credential.
 *
 * Read before Firebase Auth starts, to decide whether the sign-in machinery
 * has to be loaded at boot (see `data/firebase.ts`). Wrong either way costs
 * only speed: a stale `true` means the sign-in popup may open a moment later
 * (and fall back to redirect); a missing one means one slower boot.
 */
const KEY = 'plano.auth.signedIn';

export function hasSignedInHint(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setSignedInHint(signedIn: boolean): void {
  try {
    if (signedIn) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // No storage: every boot takes the slower path, which still works.
  }
}
