/**
 * SPEC 18 — the PIN lock.
 *
 * WHAT THIS IS: a shoulder-surfing deterrent. A ward computer or a phone left
 * on a desk should not show patient names to whoever walks past.
 *
 * WHAT THIS IS NOT: encryption. The notes live in IndexedDB in plaintext,
 * because Firestore's offline cache requires that. Anyone with the unlocked
 * device and developer tools can read them regardless of this PIN. Saying so
 * plainly matters more than the feature does — a user who believes their PIN
 * encrypts the record will make worse decisions about where they leave the
 * device than one who knows it does not.
 *
 * The PIN is therefore stored as a salted PBKDF2 hash in localStorage and never
 * sent to Firestore. It is a device-local lock, not an authentication factor,
 * and it deliberately has no server-side recovery: forgetting it means signing
 * out, which clears the local cache and re-syncs from the server.
 */

const STORAGE_KEY = 'visite.pin';
const ITERATIONS = 150_000;
const KEY_LENGTH_BITS = 256;

interface StoredPin {
  version: 1;
  salt: string;
  hash: string;
  iterations: number;
}

function toBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    material,
    KEY_LENGTH_BITS,
  );
  return toBase64(bits);
}

export function hasPin(): boolean {
  return readStored() !== null;
}

function readStored(): StoredPin | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPin;
    return parsed.version === 1 ? parsed : null;
  } catch (error) {
    console.warn('[pin] stored value unreadable', error);
    return null;
  }
}

export async function setPin(pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt, ITERATIONS);
  const stored: StoredPin = {
    version: 1,
    salt: toBase64(salt.buffer as ArrayBuffer),
    hash,
    iterations: ITERATIONS,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export function clearPin(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = readStored();
  if (!stored) return true;

  const candidate = await derive(pin, fromBase64(stored.salt), stored.iterations);
  return timingSafeEqual(candidate, stored.hash);
}

/**
 * Not strictly required for a local lock, but comparing with `===` here would
 * be the kind of detail that gets copied into a context where it does matter.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 8;
