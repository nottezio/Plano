/**
 * A slow network at start-up is treated as no network (2026-10-05).
 *
 * WHY "MEMUAT…" TOOK 6–17 SECONDS
 *
 * The session log showed every slow wait was the same one: page start to
 * signed in. Firebase Auth does not report a stored user until it has asked
 * Google about it: `initializeCurrentUser` → `reloadAndSetCurrentUserOrClear`
 * → `_reloadWithoutSaving`, which awaits a token refresh and an account
 * lookup, two round trips. With NO network they fail at once and the SDK keeps
 * the stored user; on a network that is slow but not dead (hospital wifi) they
 * hang, up to the SDK's 30 s timeout.
 *
 * And it holds up more than the sign-in screen: Firestore queues every
 * operation, cache reads included, behind Auth's first token. So nothing the
 * device already has could be shown until Google answered.
 *
 * THE FIX
 *
 * During that one boot check, an auth request that has not answered within
 * `BOOT_AUTH_CAP_MS` is failed as a network error. The SDK's contract for a
 * network error at boot is to keep the stored user (auth_impl.ts:
 * "Changing this to a different error code will log user out when there is a
 * network error"; pinned by `bootAuthCap.contract.test.ts`). The boot then
 * takes the path it already takes offline: the cached copy is shown, Firestore
 * fetches a fresh token and syncs as soon as the network answers.
 *
 * WHAT IT DOES NOT CHANGE
 *
 * - Sync. Writes queue and merge exactly as an offline boot's do: the
 *   compare-and-set on `bodyHash` and the three-way merge (localBase) are what
 *   stop an older SOAP replacing a newer one, and waiting for Google never
 *   made the cached copy any fresher: the first snapshot came from cache
 *   either way.
 * - Revocation. A disabled account is still signed out at the next token
 *   refresh, and `firestore.rules` refuse it regardless; AccessGate closes the
 *   app live.
 * - Sign-in, sign-out and any request after boot: the cap is released at the
 *   first auth state, and is never installed on a device with nobody signed
 *   in (nothing stored to keep).
 */

/** Long enough for a healthy round trip pair, short enough not to be "Memuat…". */
export const BOOT_AUTH_CAP_MS = 3000;

const AUTH_HOSTS = new Set(['identitytoolkit.googleapis.com', 'securetoken.googleapis.com']);

function hostOf(input: unknown): string | null {
  try {
    if (typeof input === 'string') return new URL(input).hostname;
    if (input instanceof URL) return input.hostname;
    if (typeof Request !== 'undefined' && input instanceof Request) return new URL(input.url).hostname;
  } catch {
    // A relative or malformed URL is not an auth request.
  }
  return null;
}

export interface BootAuthCap {
  /** Ends the boot window. Idempotent. */
  release: () => void;
  /** Whether a boot auth request was cut short, i.e. the app opened from the device's copy. */
  capped: () => boolean;
}

/**
 * Installs the cap on `globalThis.fetch` (the SDK looks `fetch` up at each
 * request). Requests to other hosts, and every request after `release`, pass
 * straight through.
 */
export function installBootAuthCap(capMs = BOOT_AUTH_CAP_MS): BootAuthCap {
  const original = globalThis.fetch;
  let active = typeof original === 'function';
  let wasCapped = false;
  let installed: typeof fetch | null = null;

  if (active) {
    const capped: typeof fetch = (input, init) => {
      const host = active ? hostOf(input) : null;
      if (!host || !AUTH_HOSTS.has(host)) return original(input, init);
      return new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => {
          wasCapped = true;
          // A TypeError is what a dead network gives fetch; the SDK maps any
          // non-Firebase error to auth/network-request-failed.
          reject(new TypeError('Plano: auth check slow at start-up, opened from this device'));
        }, capMs);
        original(input, init).then(
          (response) => {
            clearTimeout(timer);
            resolve(response);
          },
          (error: unknown) => {
            clearTimeout(timer);
            reject(error instanceof Error ? error : new TypeError(String(error)));
          },
        );
      });
    };
    globalThis.fetch = capped;
    installed = capped;
  }

  return {
    release: () => {
      if (!active) return;
      active = false;
      // Put the original back unless something else wrapped fetch after us;
      // then the wrapper stays but, inactive, only passes through.
      if (installed && globalThis.fetch === installed) globalThis.fetch = original;
    },
    capped: () => wasCapped,
  };
}
