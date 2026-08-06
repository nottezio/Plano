import { nanoid } from 'nanoid';

const STORAGE_KEY = 'visite.deviceId';

/**
 * SPEC 7 — every write is attributed to a device, not a clock.
 *
 * Conflict resolution needs to answer "was this me or the iPad?". A uid cannot
 * answer that (all three devices share one account) and a timestamp must never
 * be trusted from the client, so a stable random device id is the only sound
 * discriminator.
 *
 * Stored in localStorage rather than IndexedDB deliberately: it must be
 * readable synchronously during module init, and losing it is harmless — a
 * regenerated id degrades to "some other device", never to data loss.
 */
let cached: string | null = null;

export function getDeviceId(): string {
  if (cached) return cached;
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      cached = existing;
      return existing;
    }
    const created = nanoid(10);
    localStorage.setItem(STORAGE_KEY, created);
    cached = created;
    return created;
  } catch (error) {
    // Private mode / storage disabled. An ephemeral id still lets merge work
    // within the session; it just cannot recognise itself after a reload.
    console.warn('[device] persistent id unavailable, using ephemeral', error);
    cached = nanoid(10);
    return cached;
  }
}

/** Human-facing device label shown in conflict dialogs and revision trails. */
export function describeDevice(): string {
  const ua = navigator.userAgent;
  if (/iPad/.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in document)) return 'iPad';
  if (/iPhone|iPod/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Perangkat lain';
}
